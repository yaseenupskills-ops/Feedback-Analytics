"""
Analysis engine factory.

Selects the analysis engine based on the SENTIMENT_ENGINE environment variable:

    vader        -> VADER sentiment + keyword-rule categories   (default)
    huggingface  -> pretrained HF sentiment + zero-shot categories
    llm          -> LLM API returning strict JSON, with a VADER fallback

Every engine module exposes `analyze(text) -> AnalysisResult` with an identical
result shape, so switching engines requires no other code changes.
"""

import logging

from engines import vader
from engines.base import AnalysisResult  # re-export for convenience

logger = logging.getLogger("ai-service")

VALID_ENGINES = ("vader", "huggingface", "llm")


def get_engine(name):
    """Return the engine module for `name`. Unknown names raise ValueError."""
    engine_name = (name or "vader").strip().lower()

    if engine_name == "vader":
        return vader
    if engine_name == "huggingface":
        from engines import huggingface

        return huggingface
    if engine_name == "llm":
        from engines import llm

        return llm

    raise ValueError(
        f"Unknown SENTIMENT_ENGINE '{engine_name}'. "
        f"Must be one of: {', '.join(VALID_ENGINES)}"
    )


__all__ = ["get_engine", "AnalysisResult", "VALID_ENGINES"]