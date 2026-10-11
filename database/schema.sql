-- ==============================================================================
-- Database Schema for Feedback Analytics Platform
-- ==============================================================================

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS analysis_results CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
-- Stores administrative users who can access the dashboard and reports
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categories Table
-- Stores predefined classification categories for feedback comments
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 3. Feedback Table
-- Stores raw feedback submissions from users
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    comment TEXT NOT NULL,
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    submitter_name TEXT,
    is_anonymous BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Analysis Results Table
-- Stores AI classification output (sentiment, confidence, category, keywords)
-- Exactly one analysis result per feedback item
CREATE TABLE analysis_results (
    id SERIAL PRIMARY KEY,
    feedback_id INT UNIQUE REFERENCES feedback(id) ON DELETE CASCADE,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    confidence NUMERIC(4,3),
    category_id INT REFERENCES categories(id),
    keywords TEXT[],
    analyzed_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- Indexes for performance optimization
-- ==============================================================================

-- Index for filtering and sorting feedback by submission date (trend analysis)
CREATE INDEX idx_feedback_created_at ON feedback(created_at);

-- Index for filtering and aggregating analysis results by sentiment
CREATE INDEX idx_analysis_results_sentiment ON analysis_results(sentiment);

-- Index for joining and filtering analysis results by category
CREATE INDEX idx_analysis_results_category_id ON analysis_results(category_id);
