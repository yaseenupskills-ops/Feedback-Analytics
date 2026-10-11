/**
 * Analysis worker.
 *
 * A lightweight, PostgreSQL-backed job runner (no Redis/queue framework needed).
 * It claims due rows from `analysis_queue`, calls the AI service (which retries
 * transient failures internally), persists the result into `analysis_results`,
 * and marks the job done — or reschedules it with exponential backoff / marks it
 * failed once `max_attempts` is exhausted.
 *
 * The claim uses `FOR UPDATE SKIP LOCKED`, so running multiple worker instances
 * (or the same worker in several processes) is safe: each row is processed once.
 *
 * Started automatically from server.js. Can also run standalone for scale-out:
 *     node src/jobs/analysisWorker.js
 */

const db = require('../config/db');
const { analyzeFeedback } = require('../services/aiClient');

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_BATCH_SIZE = 5;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 60000;

function readIntEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const state = {
  running: false,
  timer: null,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  batchSize: DEFAULT_BATCH_SIZE,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Looks up a category id by name (case-insensitive), falling back to 'Other'.
 * Mirrors the lookup the submit route used before analysis moved off-request.
 */
async function getCategoryIdByName(categoryName) {
  if (!categoryName) return null;
  const result = await db.query('SELECT id FROM categories WHERE name ILIKE $1', [categoryName]);
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  const fallback = await db.query("SELECT id FROM categories WHERE name = 'Other'");
  return fallback.rows.length > 0 ? fallback.rows[0].id : null;
}

const UPSERT_ANALYSIS_SQL = `
  INSERT INTO analysis_results (feedback_id, sentiment, confidence, category_id, keywords)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (feedback_id) DO UPDATE SET
    sentiment = EXCLUDED.sentiment,
    confidence = EXCLUDED.confidence,
    category_id = EXCLUDED.category_id,
    keywords = EXCLUDED.keywords,
    analyzed_at = now()
`;

/**
 * Atomically claims up to `batchSize` due jobs and marks them 'processing'.
 * Returns the claimed rows (id, feedback_id, attempts, max_attempts).
 */
async function claimJobs(batchSize) {
  const { rows } = await db.query(
    `
      UPDATE analysis_queue
         SET status = 'processing', updated_at = now()
       WHERE id IN (
         SELECT id
           FROM analysis_queue
          WHERE status = 'pending'
            AND next_attempt_at <= now()
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       RETURNING id, feedback_id, attempts, max_attempts
    `,
    [batchSize]
  );
  return rows;
}

function retryBackoffMs(attempts) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(attempts - 1, 0), RETRY_MAX_MS);
}

/**
 * Processes a single claimed job. Never throws: failures are recorded on the
 * queue row so the batch loop keeps going.
 */
async function processJob(job) {
  try {
    const { rows } = await db.query('SELECT comment FROM feedback WHERE id = $1', [job.feedback_id]);
    if (rows.length === 0) {
      // Feedback vanished (cascade should have removed the queue row too).
      await db.query("UPDATE analysis_queue SET status = 'done', updated_at = now() WHERE id = $1", [job.id]);
      return;
    }

    const analysis = await analyzeFeedback(rows[0].comment);
    const categoryId = await getCategoryIdByName(analysis.category);

    await db.query(UPSERT_ANALYSIS_SQL, [
      job.feedback_id,
      analysis.sentiment,
      analysis.confidence,
      categoryId,
      analysis.keywords || [],
    ]);

    await db.query("UPDATE analysis_queue SET status = 'done', updated_at = now() WHERE id = $1", [job.id]);
  } catch (err) {
    const nextAttempts = job.attempts + 1;
    const exhausted = nextAttempts >= job.max_attempts;

    if (exhausted) {
      await db.query(
        `UPDATE analysis_queue
            SET status = 'failed', attempts = $2, last_error = $3, updated_at = now()
          WHERE id = $1`,
        [job.id, nextAttempts, err.message]
      );
      console.error(`[analysis-worker] feedback ${job.feedback_id} failed permanently: ${err.message}`);
    } else {
      await db.query(
        `UPDATE analysis_queue
            SET status = 'pending', attempts = $2, last_error = $3,
                next_attempt_at = now() + ($4 || ' milliseconds')::interval,
                updated_at = now()
          WHERE id = $1`,
        [job.id, nextAttempts, err.message, String(retryBackoffMs(nextAttempts))]
      );
      console.warn(
        `[analysis-worker] feedback ${job.feedback_id} attempt ${nextAttempts}/${job.max_attempts} failed, retrying: ${err.message}`
      );
    }
  }
}

/**
 * Claims and processes one batch. Exported for tests and manual triggering.
 * @returns {Promise<number>} number of jobs processed
 */
async function runOnce() {
  const batchSize = readIntEnv('ANALYSIS_BATCH_SIZE', DEFAULT_BATCH_SIZE);
  const jobs = await claimJobs(batchSize);
  for (const job of jobs) {
    await processJob(job);
  }
  return jobs.length;
}

async function loop() {
  while (state.running) {
    try {
      await runOnce();
    } catch (err) {
      // e.g. transient DB outage — log and keep the worker alive.
      console.error('[analysis-worker] batch error:', err.message);
    }
    if (!state.running) break;
    await sleep(state.pollIntervalMs);
  }
}

/**
 * Starts the polling loop (idempotent).
 */
function startAnalysisWorker(options = {}) {
  if (state.running) return;
  state.pollIntervalMs = options.pollIntervalMs || readIntEnv('ANALYSIS_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS);
  state.running = true;
  console.log(`[analysis-worker] started (poll every ${state.pollIntervalMs}ms)`);
  loop();
}

/**
 * Signals the loop to stop after the current batch.
 */
function stopAnalysisWorker() {
  if (!state.running) return;
  state.running = false;
  console.log('[analysis-worker] stopping…');
}

// Allow standalone execution: `node src/jobs/analysisWorker.js`
if (require.main === module) {
  startAnalysisWorker();
  const shutdown = () => {
    stopAnalysisWorker();
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startAnalysisWorker,
  stopAnalysisWorker,
  runOnce,
  getCategoryIdByName,
  processJob,
};
