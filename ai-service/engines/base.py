"""
Shared types and constants for the analysis engines.

Every engine exposes the same `analyze(text) -> AnalysisResult` interface and
returns the exact shape the API contract requires:

    {sentiment, confidence, category, keywords}
"""

from dataclasses import dataclass, field
from typing import List

from categories import CATEGORY_KEYWORDS

# Canonical sentiments used across every engine (matches the DB CHECK constraint).
VALID_SENTIMENTS = ("positive", "neutral", "negative")

# Canonical category labels (identical to the keyword-rule classifier's space).
CATEGORIES = tuple(CATEGORY_KEYWORDS.keys())


@dataclass(frozen=True)
class AnalysisResult:
    sentiment: str
    confidence: float
    category: str
    keywords: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serializes to the exact API contract shape."""
        return {
            "sentiment": self.sentiment,
            "confidence": self.confidence,
            "category": self.category,
            "keywords": list(self.keywords),
        }


def normalize_category(value) -> str:
    """Coerces an engine's category value to a canonical label, falling back to 'Other'."""
    label = str(value or "Other").strip()
    if label.isdigit():
        return "Other"
    for canonical in CATEGORIES:
        if canonical.lower() == label.lower():
            return canonical
    return "Other"