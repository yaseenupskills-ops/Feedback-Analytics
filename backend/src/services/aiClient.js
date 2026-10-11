/**
 * Client service to communicate with Python FastAPI AI microservice.
 *
 * Calls are retried with exponential backoff + jitter so transient failures
 * (network blips, timeouts, 5xx from a cold-started model) do not permanently
 * leave a comment unanalyzed. 4xx responses are treated as caller errors and are
 * not retried.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const RETRY_BASE_MS = 300;
const RETRY_MAX_MS = 5000;

function readIntEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Resolved lazily so tests can adjust env vars before the first call.
function getConfig() {
  return {
    maxAttempts: readIntEnv('AI_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
    timeoutMs: readIntEnv('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the backoff delay for a given retry (1-based) with full jitter.
 * 300ms, 600ms, 1200ms ... capped at RETRY_MAX_MS, each scaled by a random
 * factor in [0.5, 1] to avoid retry storms.
 */
function backoffDelay(attempt) {
  const exponential = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

/**
 * Classifies an error as retryable. HTTP 4xx is a caller error (bad payload)
 * and is never retried; network errors, timeouts, and 5xx are retryable.
 */
function isRetryable(error) {
  if (error && typeof error.statusCode === 'number') {
    return error.statusCode >= 500;
  }
  return true;
}

async function attemptAnalysis(text, timeoutMs) {
  const url = `${AI_SERVICE_URL}/analyze`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      const timeoutError = new Error(`AI service request timed out after ${timeoutMs}ms`);
      timeoutError.retryable = true;
      throw timeoutError;
    }
    error.retryable = true; // network-level failure
    throw error;
  }

  if (!response.ok) {
    let errorMessage = `AI service error (HTTP ${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch (_) {
      // Fall back to HTTP status message
    }
    const httpError = new Error(errorMessage);
    httpError.statusCode = response.status;
    throw httpError;
  }

  return response.json();
}

/**
 * Sends text to the AI microservice for sentiment, category, and keyword
 * analysis, retrying transient failures with exponential backoff.
 *
 * @param {string} text - Comment text to analyze
 * @returns {Promise<{sentiment: string, confidence: number, category: string, keywords: string[]}>}
 */
async function analyzeFeedback(text) {
  const { maxAttempts, timeoutMs } = getConfig();

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await attemptAnalysis(text, timeoutMs);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxAttempts && (error.retryable || isRetryable(error));
      if (!canRetry) {
        throw error;
      }
      await sleep(backoffDelay(attempt));
    }
  }

  throw lastError;
}

module.exports = {
  analyzeFeedback,
};
