const express = require('express');
const { body, query } = require('express-validator');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { analyzeFeedback } = require('../services/aiClient');

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
 * Helper to look up a category ID by its name with fallback to 'Other'
 */
async function getCategoryIdByName(categoryName) {
  if (!categoryName) return null;
  const result = await db.query(
    'SELECT id FROM categories WHERE name ILIKE $1',
    [categoryName]
  );
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  const fallback = await db.query(
    "SELECT id FROM categories WHERE name = 'Other'"
  );
  return fallback.rows.length > 0 ? fallback.rows[0].id : null;
}

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
 * Public endpoint: Submit feedback and trigger AI analysis
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

      // 2. Call AI service and store in analysis_results
      let analysisResult = null;
      try {
        const analysis = await analyzeFeedback(comment);
        const categoryId = await getCategoryIdByName(analysis.category);

        const insertAnalysisQuery = `
          INSERT INTO analysis_results (feedback_id, sentiment, confidence, category_id, keywords)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (feedback_id) DO UPDATE SET
            sentiment = EXCLUDED.sentiment,
            confidence = EXCLUDED.confidence,
            category_id = EXCLUDED.category_id,
            keywords = EXCLUDED.keywords,
            analyzed_at = now()
          RETURNING id, feedback_id, sentiment, confidence, category_id, keywords
        `;
        await db.query(insertAnalysisQuery, [
          savedFeedback.id,
          analysis.sentiment,
          analysis.confidence,
          categoryId,
          analysis.keywords || [],
        ]);

        analysisResult = {
          sentiment: analysis.sentiment,
          category: analysis.category,
          confidence: analysis.confidence,
        };
      } catch (aiError) {
        // If AI service fails or times out, log error and preserve saved feedback with null analysis
        console.error(`AI analysis failed for feedback ID ${savedFeedback.id}:`, aiError.message);
      }

      // Return { id, sentiment, category, confidence } according to contract
      return res.status(201).json({
        id: savedFeedback.id,
        sentiment: analysisResult ? analysisResult.sentiment : null,
        category: analysisResult ? analysisResult.category : null,
        confidence: analysisResult ? analysisResult.confidence : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/feedback/reanalyze
 * Admin endpoint: Analyze all feedback records that currently lack analysis_results
 */
router.post('/reanalyze', authMiddleware, async (req, res, next) => {
  try {
    // Find unanalyzed feedback items
    const unanalyzedQuery = `
      SELECT f.id, f.comment
      FROM feedback f
      LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
      WHERE ar.id IS NULL
      ORDER BY f.id ASC
    `;
    const { rows: pendingRows } = await db.query(unanalyzedQuery);

    let succeeded = 0;
    let failed = 0;

    for (const item of pendingRows) {
      try {
        const analysis = await analyzeFeedback(item.comment);
        const categoryId = await getCategoryIdByName(analysis.category);

        const insertAnalysisQuery = `
          INSERT INTO analysis_results (feedback_id, sentiment, confidence, category_id, keywords)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (feedback_id) DO UPDATE SET
            sentiment = EXCLUDED.sentiment,
            confidence = EXCLUDED.confidence,
            category_id = EXCLUDED.category_id,
            keywords = EXCLUDED.keywords,
            analyzed_at = now()
        `;
        await db.query(insertAnalysisQuery, [
          item.id,
          analysis.sentiment,
          analysis.confidence,
          categoryId,
          analysis.keywords || [],
        ]);
        succeeded++;
      } catch (err) {
        console.error(`Reanalysis failed for feedback ID ${item.id}:`, err.message);
        failed++;
      }
    }

    return res.json({
      message: 'Reanalysis complete',
      total: pendingRows.length,
      succeeded,
      failed,
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
          c.name AS category
        FROM feedback f
        LEFT JOIN analysis_results ar ON f.id = ar.feedback_id
        LEFT JOIN categories c ON ar.category_id = c.id
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
