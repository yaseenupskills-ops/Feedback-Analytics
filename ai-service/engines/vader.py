"""
VADER + keyword-rule engine.

This is the original Phase-1 approach: VADER for sentiment, the keyword-rule
classifier for category, and stopword-filtered frequency counting for keywords.

Implements the same `analyze(text)` interface as every other engine.
"""

from typing import List

from categories import classify_category
from engines.base import AnalysisResult, VALID_SENTIMENTS
from keywords import extract_keywords
from sentiment import analyze_sentiment

# Public API compatibility: expose engine name for factory introspection.
ENGINE_NAME = "vader"


def analyze(text: str) -> AnalysisResult:
    """Analyze `text` using VADER sentiment + keyword-rule category classification."""
    sentiment, confidence = analyze_sentiment(text)
    category = classify_category(text)
    keywords: List[str] = extract_keywords(text, max_keywords=5)

    if sentiment not in VALID_SENTIMENTS:
        sentiment = "neutral"

    return AnalysisResult(
        sentiment=sentiment,
        confidence=round(min(max(float(confidence), 0.0), 1.0), 3),
        category=category,
        keywords=keywords,
    )