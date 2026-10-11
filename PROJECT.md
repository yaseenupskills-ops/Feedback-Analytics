1. Overview

A web app that collects user feedback and uses AI to analyze each comment for sentiment (Positive / Negative / Neutral) and category (e.g. Teaching, Facilities, Food, Internet, Service, Pricing, Support, Other). An admin dashboard shows charts, trends, keywords, and a filterable comments table.

2. Tech stack (do not substitute)
Layer	Technology
Frontend	React (Vite), Tailwind CSS, Recharts, React Router, Axios
Backend	Node.js, Express, pg, bcrypt, jsonwebtoken, cors, dotenv, express-validator, helmet, express-rate-limit
AI service	Python 3, FastAPI, Uvicorn, VADER (vaderSentiment) + keyword-rule category classifier
Database	PostgreSQL
Config	.env files (never commit), .env.example committed
3. Folder structure
feedback-analytics/
├── PROJECT.md
├── README.md
├── .gitignore
├── database/
│   ├── schema.sql
│   └── seed.sql
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/ (auth.js, validate.js, errorHandler.js)
│       ├── routes/ (auth.js, feedback.js, analytics.js)
│       ├── controllers/
│       ├── jobs/analysisWorker.js
│       └── services/aiClient.js
├── ai-service/
│   ├── requirements.txt
│   ├── main.py
│   ├── sentiment.py
│   ├── categories.py
│   └── keywords.py
└── frontend/
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx, App.jsx
        ├── api/client.js
        ├── components/
        ├── pages/ (FeedbackForm, Login, Dashboard, Comments)
        └── context/AuthContext.jsx
4. Database schema
sql
users(id SERIAL PK, name, email UNIQUE NOT NULL, password_hash NOT NULL,
      role TEXT DEFAULT 'admin', created_at TIMESTAMPTZ DEFAULT now())

categories(id SERIAL PK, name TEXT UNIQUE NOT NULL)

feedback(id SERIAL PK, comment TEXT NOT NULL, rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
         submitter_name TEXT, is_anonymous BOOLEAN DEFAULT true,
         created_at TIMESTAMPTZ DEFAULT now())

analysis_results(id SERIAL PK, feedback_id INT UNIQUE REFERENCES feedback(id) ON DELETE CASCADE,
                 sentiment TEXT CHECK (sentiment IN ('positive','negative','neutral')),
                 confidence NUMERIC(4,3), category_id INT REFERENCES categories(id),
                 keywords TEXT[], analyzed_at TIMESTAMPTZ DEFAULT now())

analysis_queue(id SERIAL PK, feedback_id INT UNIQUE NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
               status TEXT CHECK (status IN ('pending','failed','done')) DEFAULT 'pending',
               attempts INT DEFAULT 0, max_attempts INT DEFAULT 3, last_error TEXT,
               next_attempt_at TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now(),
               updated_at TIMESTAMPTZ DEFAULT now())

Add indexes on feedback(created_at), analysis_results(sentiment), analysis_results(category_id),
and analysis_queue(status, next_attempt_at).

5. API contract

Public

POST /api/feedback — body {comment, rating?, submitter_name?, is_anonymous?}; saves the comment, enqueues it for background AI analysis, and returns {id, sentiment: null, category: null, confidence: null, analysis_status: 'pending'}. Analysis runs asynchronously (see worker below).
GET /api/feedback/:id/status — public; returns {id, analysis_status, sentiment, category, confidence} for one submission (analysis only, no PII).

Auth

POST /api/auth/login — body {email, password}; returns {token, user}.

Admin (JWT required)

GET /api/feedback — query: sentiment, category, from, to, search, page, limit; returns paginated comments with analysis and per-row analysis_status.
GET /api/feedback/export.csv — same filters, returns CSV.
POST /api/feedback/reanalyze — enqueues every comment lacking a completed analysis (never-queued or previously failed); returns 202 {queued}.
GET /api/analytics/summary — totals, sentiment counts, average rating, pendingAnalysis, failedAnalysis.
GET /api/analytics/trend — query: from, to, interval=day|week|month; sentiment counts per interval.
GET /api/analytics/categories — counts per category split by sentiment.
GET /api/analytics/keywords — top 50 keywords with counts.

Background worker (backend/src/jobs/analysisWorker.js)

Polls analysis_queue every ANALYSIS_POLL_INTERVAL_MS (default 2000ms), atomically claims due jobs
(FOR UPDATE SKIP LOCKED), calls the AI service, upserts analysis_results, and marks the job done.
Failures retry with exponential backoff up to max_attempts, then become 'failed'.

AI service (internal, not exposed to frontend)

POST /analyze — body {text}; returns {sentiment, confidence, category, keywords}.
GET /health
6. Pages
/ Feedback form (public): comment, star rating, optional name, anonymous toggle, success message showing the detected sentiment.
/login Admin login.
/admin Dashboard: summary cards, sentiment donut, trend line, category stacked bars, keyword cloud, date range filter.
/admin/comments Comments table: search, filters, sort, pagination, CSV export.
7. Rules for the agent
Follow the stack and folder structure exactly. Do not add other frameworks.
Use parameterized SQL queries only (no string concatenation).
Hash passwords with bcrypt. Never log or return password hashes.
All secrets and URLs come from environment variables.
Validate all inputs on the backend. Cap comment length at 2000 characters.
Return consistent JSON errors: { "error": "message" }.
After each phase: list the files created/changed, how to run and test it, and a short plain-English explanation of how it works.
Do not implement anything from a later phase.