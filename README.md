# Feedback Analytics Platform

An AI-powered feedback collection and analytics platform. Users submit feedback
with an optional star rating; a Python AI service classifies every comment into a
**sentiment** (positive / neutral / negative), a **category** (Teaching, Facilities,
Food, Internet, Service, Pricing, Support, Other), and a set of **keywords**.
Admins then explore the results through an interactive dashboard (charts, trends,
keyword cloud) and a filterable comments table with CSV export.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started (Local Development)](#getting-started-local-development)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Testing](#testing)
10. [Screenshots](#screenshots)
11. [Deployment](#deployment)
12. [Future Improvements](#future-improvements)

---

## Overview

A web app that collects user feedback and uses AI to analyze each comment for
sentiment and category. The admin area shows summary cards, a sentiment donut,
a trend line (day/week/month), per-category stacked bars, ranked keywords, and a
date-range filter that refreshes every widget. A comments table supports
debounced search, sentiment/category filters, sorting, pagination, and CSV export.
Clicking any chart segment jumps to the comments table with that filter applied.

## Features

- **Public feedback form** — star rating, optional name, anonymous toggle, real-time
  AI result (sentiment, confidence, category).
- **Admin dashboard (`/admin`)** — summary cards, Recharts donut, trend line with
  day/week/month toggle, category stacked bars, keyword chips, date-range filter,
  loading skeletons, and friendly empty states.
- **Comments table (`/admin/comments`)** — debounced search, filters, sort,
  pagination, and CSV export that honors the current filters.
- **Security** — parameterized SQL only, JWT auth with role checks, bcrypt-hashed
  passwords, CORS allowlist, rate limiting, helmet headers, input validation,
  CSV formula-injection protection.

## Architecture

```
+------------------+        +------------------+        +------------------+
|   Browser / SPA  | -----> |    Backend API   | -----> |  PostgreSQL DB   |
|  React (Vite)    |  HTTPS | Node.js + Express|  SQL   |  Supabase / Neon |
|  Vercel          |  JWT   |  Render          |        |  Render Postgres |
+------------------+        +--------+---------+        +------------------+
                                     |
                                     | HTTP (server-to-server, internal)
                                     v
                           +---------------------+
                           |   AI Service        |
                           |  FastAPI + VADER    |
                           |  keyword-rule       |
                           |  classifier         |
                           |  Render             |
                           +---------------------+
```

1. The React SPA calls only the Express API over HTTPS (JWT in the `Authorization`
   header — it never talks to the AI service directly).
2. The Express API validates input, enforces auth, and stores data in PostgreSQL
   through parameterized queries.
3. When feedback is submitted, the backend calls the FastAPI AI service, which
   returns `{ sentiment, confidence, category, keywords }`; the result is stored
   one-to-one with the feedback row.

## Tech Stack

| Layer        | Technology                                                                              |
| ------------ | --------------------------------------------------------------------------------------- |
| Frontend     | React (Vite), Tailwind CSS, Recharts, React Router, Axios                               |
| Backend      | Node.js, Express, pg, bcrypt, jsonwebtoken, cors, dotenv, express-validator, helmet, express-rate-limit |
| AI service   | Python 3, FastAPI, Uvicorn, VADER (vaderSentiment) + keyword-rule category classifier  |
| Database     | PostgreSQL                                                                              |
| Config       | `.env` files (never commit), `.env.example` committed                                   |

## Project Structure

```
feedback-analytics/
├── PROJECT.md
├── README.md
├── .gitignore
├── render.yaml                    # Render blueprint (backend + AI service + optional DB)
├── database/
│   ├── schema.sql
│   └── seed.sql                   # Demo admin user + 40 sample comments with analysis
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/            # auth.js, validate.js, errorHandler.js
│       ├── routes/                # auth.js, feedback.js, analytics.js
│       └── services/aiClient.js
├── ai-service/
│   ├── requirements.txt
│   ├── main.py                    # FastAPI entry point (/health, /analyze)
│   ├── sentiment.py               # VADER sentiment + confidence
│   ├── categories.py              # keyword-rule category classification
│   ├── keywords.py                # stopword-filtered keyword extraction
│   └── tests/test_analyze.py
└── frontend/
    ├── package.json
    ├── vercel.json                # SPA rewrites + Vite build settings
    ├── .env.example
    └── src/
        ├── main.jsx, App.jsx
        ├── api/client.js
        ├── components/            # Navbar, ProtectedRoute, StarRating, DateRangeFilter
        ├── pages/                 # FeedbackForm, Login, Dashboard, Comments
        └── context/AuthContext.jsx
```

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- PostgreSQL 14+ (or a Supabase / Neon hosted database)
- (Optional) a CORS-enabled browser — any modern one works

### 1. Database

Create a database and apply the schema + seed:

```bash
createdb feedback_analytics
psql -d feedback_analytics -f database/schema.sql
psql -d feedback_analytics -f database/seed.sql
```

The seed creates a demo admin account and 40 sample comments with pre-computed
analysis results so the dashboard is instantly populated.

### 2. AI service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

### 3. Backend

```bash
cd backend
cp .env.example .env        # then edit .env with your real values
npm install
npm run dev                 # http://localhost:5001
```

Verify: `curl http://localhost:5001/api/health`

### 4. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL should point at the backend
npm install
npm run dev                 # http://localhost:5173
```

Log in at `http://localhost:5173/login` with the demo admin account:
`admin@example.com` / `Admin@123` — **change this password after your first
deployment.**

## Environment Variables

### Backend (`.env` in `backend/`)

| Variable         | Required | Default                 | Description                                                                      |
| ---------------- | -------- | ----------------------- | -------------------------------------------------------------------------------- |
| `PORT`           | No       | `5000`                  | Express listen port. Render injects its own `PORT`.                              |
| `DATABASE_URL`   | Yes      | —                       | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/dbname`     |
| `DATABASE_SSL`   | No       | unset                   | Set `true` for Supabase / Neon (TLS). `?sslmode=require` in the URL also works.  |
| `JWT_SECRET`     | Yes      | —                       | Long random secret used to sign admin JWTs. Use `openssl rand -hex 32`.          |
| `AI_SERVICE_URL` | No       | `http://localhost:8000` | Base URL of the FastAPI AI service.                                              |
| `CORS_ORIGIN`    | No       | localhost dev origins   | Comma-separated allowed origins, e.g. `https://myapp.vercel.app,http://localhost:5173` |

The server fails fast at startup if `DATABASE_URL` or `JWT_SECRET` is missing.

### Frontend (`.env` in `frontend/`)

| Variable      | Required | Default                 | Description                                                  |
| ------------- | -------- | ----------------------- | ------------------------------------------------------------ |
| `VITE_API_URL`| No       | `http://localhost:5001` | Base URL of the backend (must point at the deployed API in production). |

### AI service

The analysis engine is selected at startup by `SENTIMENT_ENGINE`. No variables are
required (the service defaults to the lightweight `vader` engine); the extra
variables below are only used by the corresponding engine. On Render the
platform-provided `$PORT` is used.

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `SENTIMENT_ENGINE` | No | `vader` | `vader`, `huggingface`, or `llm`. Invalid values fail fast at startup. Switching requires no code changes. |
| `HF_SENTIMENT_MODEL` | No | `distilbert-base-uncased-finetuned-sst-2-english` | HF sentiment model (used when `SENTIMENT_ENGINE=huggingface`). |
| `HF_ZERO_SHOT_MODEL` | No | `typeform/distilbert-base-uncased-mnli` | HF zero-shot model for category classification (used when `SENTIMENT_ENGINE=huggingface`). |
| `LLM_API_URL` | No | `https://api.openai.com/v1/chat/completions` | Any OpenAI-compatible `/chat/completions` endpoint (used when `SENTIMENT_ENGINE=llm`). |
| `LLM_API_KEY` | No | — | Sent as `Authorization: Bearer <key>`. |
| `LLM_MODEL` | No | `gpt-4o-mini` | Model name passed in the request body. |
| `LLM_TIMEOUT` | No | `10` | Request timeout in seconds; on any failure the engine falls back to VADER + keyword rules. |

Compare engines on the same 10 comments:

```bash
cd ai-service && source venv/bin/activate
python compare_engines.py vader huggingface llm
```

The script writes results to `compare_engines_results.json`. A dev-only mock
OpenAI-compatible server (`tests/mock_llm_server.py`, run on port `8001`) can
exercise the LLM engine without a paid API key.

## API Reference

Base URL: `http://localhost:5001/api` (or your deployed backend). All responses
are JSON. Errors always use the shape `{ "error": "message" }`.

### Public endpoints

#### `POST /auth/login`

Authenticate an admin and obtain a JWT.

```json
// Request
{ "email": "admin@example.com", "password": "Admin@123" }

// Response 200
{ "token": "<jwt>", "user": { "id": 1, "name": "Admin User", "email": "admin@example.com", "role": "admin" } }
```

#### `POST /feedback`

Submit feedback. The comment is saved, sent to the AI service, and analyzed.
Succeeds even if the AI service is unavailable (returns `null` analysis fields).

```json
// Request
{ "comment": "The wi-fi in the dorms keeps dropping.", "rating": 2, "submitter_name": null, "is_anonymous": true }

// Response 201
{ "id": 42, "sentiment": "negative", "category": "Internet", "confidence": 0.955 }
```

Validation: `comment` required (≤ 2000 chars), `rating` integer 1–5 (optional),
`submitter_name` ≤ 255 chars (optional), `is_anonymous` boolean (optional).

### Admin endpoints (JWT required — `Authorization: Bearer <token>`)

#### `GET /feedback`

Paginated list of comments joined with their analysis results.

| Query      | Type   | Description                                            |
| ---------- | ------ | ------------------------------------------------------ |
| `page`     | int    | Page number, starts at 1 (default 1).                  |
| `limit`    | int    | Rows per page, 1–100 (default 10).                     |
| `sentiment`| enum   | `positive` \| `neutral` \| `negative`.                 |
| `category` | string | Category name or numeric ID.                           |
| `search`   | string | Case-insensitive substring match on the comment (≤ 200 chars). |
| `from`/`to`| ISO 8601 | Date range filter on `created_at`.                     |
| `sort`     | enum   | `newest` \| `oldest` \| `rating_desc` \| `rating_asc`.  |

```json
// Response 200
{
  "data": [
    {
      "id": 18, "comment": "...", "rating": 1, "submitter_name": null,
      "is_anonymous": true, "created_at": "2026-08-18T06:54:15.786Z",
      "sentiment": "negative", "confidence": 0.955,
      "keywords": ["wi-fi", "drops", "connectivity"], "analyzed_at": "...",
      "category_id": 4, "category": "Internet"
    }
  ],
  "pagination": { "total": 16, "page": 1, "limit": 10, "totalPages": 2 }
}
```

#### `GET /feedback/export.csv`

Same filters as `GET /feedback` (except `page`/`limit`) and returns a CSV download
of every matching row. Text fields are quoted and escaped, and cells that begin
with `=`, `+`, `-`, or `@` are neutralized to prevent spreadsheet formula attacks.

#### `POST /feedback/reanalyze`

Runs AI analysis on every feedback row that currently lacks an analysis result.

```json
// Response 200
{ "message": "Reanalysis complete", "total": 3, "succeeded": 3, "failed": 0 }
```

#### `GET /analytics/summary`

```json
// Response 200
{
  "totalFeedback": 47,
  "averageRating": 3.17,
  "sentimentCounts": { "positive": 20, "neutral": 11, "negative": 16 }
}
```

#### `GET /analytics/trend`

| Query       | Type          | Description                              |
| ----------- | ------------- | ---------------------------------------- |
| `interval`  | enum          | `day` \| `week` \| `month` (default `day`) |
| `from`/`to` | ISO 8601      | Optional date range.                     |

```json
// Response 200
[
  { "date": "2026-08-09T18:30:00.000Z", "total": 4, "positive": 3, "neutral": 0, "negative": 1 }
]
```

#### `GET /analytics/categories`

Sentiment split per category.

```json
[
  { "id": 2, "category": "Facilities", "total": 8, "positive": 5, "neutral": 0, "negative": 3 }
]
```

#### `GET /analytics/keywords`

Top 50 keywords by frequency.

```json
[ { "keyword": "campus", "count": 3 } ]
```

#### `GET /health`

Liveness probe. → `{ "status": "ok" }`

## Testing

### AI service (unit tests)

```bash
cd ai-service
source venv/bin/activate
pytest -q
```

### Backend

There is no automated test suite for the backend yet. A quick manual check:

```bash
# start postgres + ai service + backend first
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin@123"}' | jq -r .token)

curl -s http://localhost:5001/api/analytics/summary -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:5001/api/feedback?sentiment=negative&sort=rating_asc" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:5001/api/feedback/export.csv?category=Food" -H "Authorization: Bearer $TOKEN"
```

### Frontend

```bash
cd frontend
npm run build     # production build sanity check
```

Manual check: submit feedback at `/`, log in at `/login`, explore `/admin` and
`/admin/comments`, apply filters, export CSV, and click chart segments to confirm
the deep link into the comments table.

## Screenshots

> Drop screenshots into `docs/screenshots/` and reference them here.

| Public feedback form | Admin dashboard | Comments table |
| -------------------- | --------------- | -------------- |
| ![Feedback form](docs/screenshots/feedback-form.png) | ![Dashboard](docs/screenshots/dashboard.png) | ![Comments](docs/screenshots/comments.png) |

## Deployment

Recommended free-tier setup: **frontend on Vercel**, **backend + AI service on
Render**, **database on Supabase or Neon**.

```
https://myapp.vercel.app        <-- React SPA (VITE_API_URL -> backend below)
        |
        v
https://feedback-backend.onrender.com   <-- Express API (render.yaml)
        |                                 |
        | internal http                   | HTTPS
        v                                 v
https://feedback-ai.onrender.com      Supabase / Neon PostgreSQL
(AI service, /analyze)               (?sslmode=require)
```

### 1. Database: Supabase or Neon

**Supabase**

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → Database → Connection string → URI** and copy the
   **Transaction pooler** string (port `6543`). It looks like:
   `postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require`
3. From `backend/`, create the tables:
   `psql "$DATABASE_URL" -f ../database/schema.sql`
4. (Optional) load demo data: `psql "$DATABASE_URL" -f ../database/seed.sql`
5. Add a `DATABASE_SSL=true` env var to the backend **or** keep `?sslmode=require`
   in the connection string — either enables TLS.

**Neon**

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string from the dashboard (it ships with
   `?sslmode=require` already, e.g. `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
3. Run `schema.sql` (and optionally `seed.sql`) with `psql`.
4. Set `DATABASE_SSL=true` on the backend for good measure.

> **Security notes:** never paste production database passwords into Vercel/Render
> environment fields in plain view of others; use the platform's
> **Encrypted / Secret** env var option and rotate the demo admin password.

### 2. Frontend: Vercel

1. Push the repo to GitHub/GitLab.
2. In Vercel: **Add New → Project → Import repo**.
3. Vercel auto-detects Vite. The included `frontend/vercel.json` sets the build
   command (`npm run build`), output directory (`dist`), and an SPA rewrite so
   `/admin` and `/admin/comments` work on refresh.
4. Set the environment variable:
   | Key            | Value                                       |
   | -------------- | ------------------------------------------- |
   | `VITE_API_URL` | `https://feedback-backend.onrender.com`     |
5. **Deploy.** After the first deploy, copy your URL (e.g.
   `https://feedback-analytics.vercel.app`) and use it as `CORS_ORIGIN` on Render.

### 3. Backend + AI service: Render

**Option A — Blueprint (quickest):** the included `render.yaml` defines the
backend, the AI service, and an optional managed PostgreSQL. Push the repo,
then in Render: **New + → Blueprint → select repo → Apply**. After the first
deploy, open each service and fix the placeholder env values (`AI_SERVICE_URL`,
`CORS_ORIGIN`) and add your Supabase/Neon `DATABASE_URL` if you didn't keep the
Render database.

**Option B — Manual:**

1. **Backend web service**: type *Web Service*, root directory `backend`,
   build command `npm ci`, start command `node src/server.js`, health check
   path `/api/health`.
2. **AI web service**: root directory `ai-service`, build command
   `pip install -r requirements.txt`, start command
   `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check path `/health`.
3. Set these environment variables on the **backend service**:

   | Key              | Value / where to get it                                                                 |
   | ---------------- | --------------------------------------------------------------------------------------- |
   | `DATABASE_URL`   | Supabase or Neon pooled connection string (with `?sslmode=require`).                    |
   | `DATABASE_SSL`   | `true` (Supabase / Neon).                                                               |
   | `JWT_SECRET`     | `openssl rand -hex 32`, enable "Generate value" / store as a secret.                    |
   | `AI_SERVICE_URL` | Your AI service URL, e.g. `https://feedback-ai.onrender.com` (or `http://feedback-ai` for Render-internal traffic). |
   | `CORS_ORIGIN`    | Your Vercel URL, e.g. `https://feedback-analytics.vercel.app`. Comma-separate several origins if needed. |
   | `PORT`           | Leave unset — Render injects `$PORT` automatically.                                      |

4. Deploy and open `/api/health` on both services to confirm they're live.

> Free-tier services on Render sleep after inactivity — the first request (or its
> health-check interval) after a sleep can take ~30–60s to wake up.

### 4. Post-deploy checklist

- [ ] `/api/health` returns `{ "status": "ok" }` on Render.
- [ ] `GET/POST /analyze` works on the AI service.
- [ ] Database tables exist (run `schema.sql`, optionally `seed.sql`).
- [ ] Frontend loads and the login at `/login` succeeds.
- [ ] Dashboard widgets and comments table populate; CSV export downloads.
- [ ] Change the seeded admin password.
- [ ] Confirm `CORS_ORIGIN` only lists your frontend origin.

## Future Improvements

- **Fine-tune on university feedback** — the Hugging Face path already runs
  DistilBERT sentiment + zero-shot categories behind `SENTIMENT_ENGINE=huggingface`.
  A dedicated fine-tuned model (trained on this dataset's labelled comments) would
  fix its current blind spot: binary SST-2 has no *neutral* class, so factual
  comments are scored confidently positive/negative. Also swap the small MNLI
  zero-shot model for a stronger NLI model to reduce category mis-assignments.
- **LLM API integration** — the `SENTIMENT_ENGINE=llm` path already calls any
  OpenAI-compatible endpoint with strict-JSON validation, timeout, and a VADER
  fallback. Future work: multi-label categories, a summarized-themes field
  (adds a key to the `/analyze` contract), and a generated natural-language
  executive summary per date range on the dashboard (surface via a new endpoint
  so the `/analyze` response format stays untouched).
- **Email alerts** — monitor sentiment trends with a scheduled job and email
  admins (SendGrid / Resend / Nodemailer) when a negative spike or a low-rated
  category crosses a threshold.
- **Security & UX follow-ups** — refresh-token flow with HttpOnly cookies instead
  of `localStorage` JWTs, admin user management (create/disable accounts),
  scheduled PDF/Slack reports, and multi-language support on the feedback form.