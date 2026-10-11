"""
Sentiment analysis module using VADER (Valence Aware Dictionary and sEntiment Reasoner).
The interface is designed as an isolated function `analyze_sentiment(text)` to enable
plug-and-play replacement with fine-tuned Hugging Face transformer models or LLM APIs.
"""

from typing import Tuple
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> Tuple[str, float]:
    """
    Analyzes sentiment of the input text using VADER.

    Rules:
    - compound >= 0.05  -> 'positive'
    - compound <= -0.05 -> 'negative'
    - otherwise         -> 'neutral'
    - confidence = |compound| clamped between 0.0 and 1.0 (rounded to 3 decimal places)

    Returns:
        (sentiment, confidence)
    """
    if not text or not text.strip():
        return "neutral", 0.0

    scores = _analyzer.polarity_scores(text)
    compound = scores.get("compound", 0.0)

    if compound >= 0.05:
        sentiment = "positive"
    elif compound <= -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    # Clamp confidence between 0.0 and 1.0
    confidence = min(max(abs(compound), 0.0), 1.0)
    return sentiment, round(float(confidence), 3)
