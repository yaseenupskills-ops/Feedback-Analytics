"""
Hugging Face transformer engine.

Uses two pretrained models (both lazy-loaded and cached in memory):

- Sentiment : `distilbert-base-uncased-finetuned-sst-2-english`
  The SST-2 model only emits POSITIVE / NEGATIVE, so the "neutral band" follows
  the same [-0.05, 0.05] polarity thresholds VADER uses. This keeps the three
  engines directly comparable on the same label space.
- Category  : zero-shot classification (`typeform/distilbert-base-uncased-mnli`)
  against the canonical category labels.

Keywords are extracted with the shared frequency-based extractor, which is
engine-agnostic. Model names can be overridden with the HF_SENTIMENT_MODEL and
HF_ZERO_SHOT_MODEL environment variables.
"""

import logging
import os
import threading
from typing import Any

from engines.base import AnalysisResult, CATEGORIES, VALID_SENTIMENTS
from keywords import extract_keywords

logger = logging.getLogger("ai-service.huggingface")

ENGINE_NAME = "huggingface"

DEFAULT_SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
DEFAULT_ZERO_SHOT_MODEL = "typeform/distilbert-base-uncased-mnli"

# Small margin around a 0.5/0.5 positive/negative split that counts as neutral.
_POLARITY_NEUTRAL_BAND = 0.05

_sentiment_pipe: Any = None
_zero_shot_pipe: Any = None
_lock = threading.Lock()


def _get_sentiment_pipeline():
    """Lazily load (and cache) the sentiment-analysis pipeline."""
    global _sentiment_pipe
    if _sentiment_pipe is None:
        from transformers import pipeline  # imported lazily: torch/transformers optional

        model = os.environ.get("HF_SENTIMENT_MODEL", DEFAULT_SENTIMENT_MODEL)
        with _lock:
            if _sentiment_pipe is None:
                _sentiment_pipe = pipeline("sentiment-analysis", model=model)
                logger.info("Loaded HF sentiment model: %s", model)
    return _sentiment_pipe


def _get_zero_shot_pipeline():
    """Lazily load (and cache) the zero-shot classification pipeline."""
    global _zero_shot_pipe
    if _zero_shot_pipe is None:
        from transformers import pipeline

        model = os.environ.get("HF_ZERO_SHOT_MODEL", DEFAULT_ZERO_SHOT_MODEL)
        with _lock:
            if _zero_shot_pipe is None:
                _zero_shot_pipe = pipeline("zero-shot-classification", model=model)
                logger.info("Loaded HF zero-shot model: %s", model)
    return _zero_shot_pipe


def _sentiment_from_probability(prob_positive: float):
    """
    Converts the model's POSITIVE probability into a (sentiment, confidence) pair.

    polarity = prob_positive * 2 - 1            # maps [0,1] -> [-1,1]
    polarity >=  +0.05  -> positive (confidence = polarity)
    polarity <=  -0.05  -> negative (confidence = -polarity)
    otherwise           -> neutral  (confidence = 1 - |polarity|)
    """
    polarity = max(-1.0, min(1.0, prob_positive * 2.0 - 1.0))
    if polarity >= _POLARITY_NEUTRAL_BAND:
        return "positive", polarity
    if polarity <= -_POLARITY_NEUTRAL_BAND:
        return "negative", -polarity
    return "neutral", 1.0 - abs(polarity)


def _normalize_model_label(label: str) -> str:
    """Maps the model's label to the canonical sentiment space."""
    normalized = str(label or "").upper()
    if normalized == "POSITIVE":
        return "positive"
    if normalized == "NEGATIVE":
        return "negative"
    return "neutral"


def analyze(text: str) -> AnalysisResult:
    """Analyze `text` with pretrained HF sentiment + zero-shot category models."""
    sentiment_pipe = _get_sentiment_pipeline()
    zero_shot_pipe = _get_zero_shot_pipeline()

    # 1. Sentiment. SST-2 returns e.g. {"label": "NEGATIVE", "score": 0.999}.
    prediction = sentiment_pipe(text, truncation=True)[0]
    label = _normalize_model_label(prediction.get("label", ""))
    prob_positive = (
        float(prediction.get("score", 0.5))
        if label == "positive"
        else 1.0 - float(prediction.get("score", 0.5))
    )
    sentiment, confidence = _sentiment_from_probability(prob_positive)

    # 2. Category via zero-shot classification against the canonical labels.
    zs = zero_shot_pipe(text, candidate_labels=list(CATEGORIES), truncation=True)
    category = str(zs["labels"][0])

    # 3. Keywords (engine-agnostic extractor).
    keywords = extract_keywords(text, max_keywords=5)

    if sentiment not in VALID_SENTIMENTS:
        sentiment = "neutral"

    return AnalysisResult(
        sentiment=sentiment,
        confidence=round(min(max(confidence, 0.0), 1.0), 3),
        category=category,
        keywords=keywords,
    )