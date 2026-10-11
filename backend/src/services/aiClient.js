/**
 * Client service to communicate with Python FastAPI AI microservice
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Sends text to the AI microservice for sentiment, category, and keyword analysis
 * @param {string} text - Comment text to analyze
 * @returns {Promise<{sentiment: string, confidence: number, category: string, keywords: string[]}>}
 */
async function analyzeFeedback(text) {
  const url = `${AI_SERVICE_URL}/analyze`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000), // 5-second timeout
    });

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
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('AI service request timed out after 5 seconds');
    }
    throw error;
  }
}

module.exports = {
  analyzeFeedback,
};
