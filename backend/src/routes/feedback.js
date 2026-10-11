const express = require('express');
const { body, query } = require('express-validator');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * Shared query validation for admin feedback listing & CSV export.
 * Keeps the API contract strict: unknown sentiments, categories, sorts,
 * malformed dates, or oversized search strings are rejected with 400.
 */
const feedbackQueryValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
  query('sentiment')
    .optional()
    .toLowerCase()
    .isIn(['positive', 'neutral', 'negative'])
    .withMessage('sentiment must be positive, neutral, or negative'),
  query('category')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('category must be a valid category name or ID'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('search must be between 1 and 200 characters'),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid ISO 8601 date'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid ISO 8601 date'),
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating_desc', 'rating_asc'])
    .withMessage('sort must be one of: newest, oldest, rating_desc, rating_asc'),
];

/**
 * Helper to build dynamic parameterized filter query for feedback
 */
function buildFeedbackFilterQuery(queryParams) {
  const { sentiment, category, from, to, search } = queryParams;
  const conditions = [];
  const values = [];

  if (sentiment) {
    values.push(sentiment.toLowerCase());
    conditions.push(`ar.sentiment = $${values.length}`);
  }

  if (category) {
    values.push(category);
    // Allow filtering by either category ID or category name
    if (!isNaN(category)) {
      conditions.push(`(c.id = $${values.length} OR c.name ILIKE $${values.length})`);
    } else {
      conditions.push(`c.name ILIKE $${values.length}`);
    }
  }

  if (from) {
    values.push(from);
    conditions.push(`f.created_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    conditions.push(`f.created_at <= $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`f.comment ILIKE $${values.length}`);
  }

  let orderClause = 'ORDER BY f.created_at DESC';
  if (queryParams.sort === 'oldest') {
    orderClause = 'ORDER BY f.created_at ASC';
  } else if (queryParams.sort === 'rating_desc') {
    orderClause = 'ORDER BY f.rating DESC NULLS LAST, f.created_at DESC';
  } else if (queryParams.sort === 'rating_asc') {
    orderClause = 'ORDER BY f.rating ASC NULLS LAST, f.created_at DESC';
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values, orderClause };
}

/**
 * POST /api/feedback
 * Public endpoint: Submit feedback and enqueue it for background AI analysis.
 *
 * The comment is saved synchronously and a job is added to `analysis_queue`.
 * The background worker performs the AI call, so submission never blocks on the
 * (potentially slow) AI service and transient AI failures are retried.
 */
router.post(
  '/',
  [
    body('comment')
      .trim()
      .notEmpty()
      .withMessage('Comment is required')
      .isLength({ max: 2000 })
      .withMessage('Comment cannot exceed 2000 characters'),
    body('rating')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be an integer between 1 and 5'),
    body('submitter_name')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 255 })
      .withMessage('Submitter name cannot exceed 255 characters'),
    body('is_anonymous')
      .optional()
      .isBoolean()
      .withMessage('is_anonymous must be a boolean'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { comment, rating = null, submitter_name = null } = req.body;
      const is_anonymous = req.body.is_anonymous !== undefined ? Boolean(req.body.is_anonymous) : true;
      const finalName = is_anonymous ? null : submitter_name;

      // 1. Parameterized INSERT into feedback table
      const insertQuery = `
        INSERT INTO feedback (comment, rating, submitter_name, is_anonymous)
        VALUES ($1, $2, $3, $4)
        RETURNING id, comment, rating, submitter_name, is_anonymous, created_at
      `;
      const { rows } = await db.query(insertQuery, [comment, rating, finalName, is_anonymous]);
      const savedFeedback = rows[0];

      // 2. Enqueue a background analysis job (idempotent per feedback item).
      try {
        await db.query(
          `INSERT INTO analysis_queue (feedback_id)
           VALUES ($1)
           ON CONFLICT (feedback_id) DO NOTHING`,
          [savedFeedback.id]
        );
      } catch (enqueueError) {
        // The feedback itself is safely stored; log so ops can re-enqueue later.
        console.error(`Failed to enqueue analysis for feedback ID ${savedFeedback.id}:`, enqueueError.message);
      }

      // Analysis runs asynchronously; sentiment/category/confidence arrive later.
      return res.status(201).json({
        id: savedFeedback.id,
        sentiment: null,
        category: null,
        confidence: null,
        analysis_status: 'pending',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/feedback/reanalyze
 * Admin endpoint: enqueue every feedback item that does not yet have a completed
 * ('done') analysis. This covers both never-queued and previously-failed items.
 *
 * Enqueueing is a single upsert, so the endpoint returns immediately; the worker
 * processes the backlog in the background.
 */
router.post('/reanalyze', authMiddleware, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(`
      INSERT INTO analysis_queue (feedback_id, status, attempts, next_attempt_at)
      SELECT f.id, 'pending', 0, now()
      FROM feedback f
      LEFT JOIN analysis_queue q ON f.id = q.feedback_id
      WHERE q.id IS NULL OR q.status <> 'done'
      ON CONFLICT (feedback_id) DO UPDATE SET
        status = 'pending',
        attempts = 0,
        last_error = NULL,
        next_attempt_at = now(),
        updated_at = now()
    `);

    return res.status(202).json({
      message: 'Reanalysis queued',
      queued: rowCount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/export.csv
 * Admin endpoint: Export filtered feedback list as CSV
 */
router.get('/export.csv', authMiddleware, feedbackQueryValidators, validate, async (req, res, next) => {
  try {
    const { whereClause, values, orderClause } = buildFeedbackFilterQuery(req.query);

    const query = `
      SELECT 
        f.id,
        f.comment,
        f.rating,
        f.submitter_name,
        f.is_anonymous,
        f.created_at,
        ar.sentiment,
        ar.confidence,
        c.name AS category,
        array_to_string(ar.keywords, ';') AS keywords
      FROM feedback f
      LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
      LEFT JOIN categories c ON ar.category_id = c.id
      ${whereClause}
      ${orderClause}
    `;

    const { rows } = await db.query(query, values);

    // Build CSV with proper quote escaping
    const headers = ['ID', 'Comment', 'Rating', 'Submitter Name', 'Is Anonymous', 'Created At', 'Sentiment', 'Confidence', 'Category', 'Keywords'];
    
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      // Prevent spreadsheet formula injection: cells starting with =, +, -, @
      // can execute as formulas when opened in Excel/Sheets. Prefix them with a
      // single quote so they are treated as harmless text.
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [
      headers.join(','),
      ...rows.map(row => [
        row.id,
        escapeCsv(row.comment),
        row.rating ?? '',
        escapeCsv(row.submitter_name ?? ''),
        row.is_anonymous ? 'true' : 'false',
        escapeCsv(row.created_at ? new Date(row.created_at).toISOString() : ''),
        escapeCsv(row.sentiment ?? ''),
        row.confidence ?? '',
        escapeCsv(row.category ?? ''),
        escapeCsv(row.keywords ?? '')
      ].join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback_export.csv"');
    return res.status(200).send(csvLines.join('\n'));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/:id/status
 * Public endpoint: returns the analysis status for a single submission so the
 * submitter-facing page can track async analysis. Exposes analysis only — never
 * comment text, submitter name, or any PII.
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'A valid feedback id is required' });
    }

    const { rows } = await db.query(
      `
        SELECT
          f.id,
          COALESCE(q.status, CASE WHEN ar.id IS NOT NULL THEN 'done' ELSE 'pending' END) AS analysis_status,
          ar.sentiment,
          ar.confidence,
          c.name AS category
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        LEFT JOIN categories c ON ar.category_id = c.id
        LEFT JOIN analysis_queue q ON f.id = q.feedback_id
        WHERE f.id = $1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const row = rows[0];
    return res.json({
      id: row.id,
      analysis_status: row.analysis_status,
      sentiment: row.sentiment ?? null,
      category: row.category ?? null,
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback
 * Admin endpoint: Paginated list of comments with joined analysis and categories
 */
router.get(
  '/',
  authMiddleware,
  feedbackQueryValidators,
  validate,
  async (req, res, next) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const offset = (page - 1) * limit;

      const { whereClause, values, orderClause } = buildFeedbackFilterQuery(req.query);

      // Total count query for pagination
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        LEFT JOIN categories c ON ar.category_id = c.id
        LEFT JOIN analysis_queue q ON f.id = q.feedback_id
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total, 10);

      // Paginated data query
      const dataValues = [...values, limit, offset];
      const dataQuery = `
        SELECT 
          f.id,
          f.comment,
          f.rating,
          f.submitter_name,
          f.is_anonymous,
          f.created_at,
          ar.sentiment,
          ar.confidence,
          ar.keywords,
          ar.analyzed_at,
          c.id AS category_id,
          c.name AS category,
          COALESCE(q.status, CASE WHEN ar.id IS NOT NULL THEN 'done' ELSE 'pending' END) AS analysis_status
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        LEFT JOIN categories c ON ar.category_id = c.id
        LEFT JOIN analysis_queue q ON f.id = q.feedback_id
        ${whereClause}
        ${orderClause}
        LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
      `;

      const { rows } = await db.query(dataQuery, dataValues);

      return res.json({
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
