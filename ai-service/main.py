"""
FastAPI Microservice for Feedback AI Analysis.

Exposes:
- GET /health
- POST /analyze

The analysis engine is selected at startup with the SENTIMENT_ENGINE environment
variable (vader | huggingface | llm). The POST /analyze response format is
identical regardless of engine:

    {sentiment, confidence, category, keywords}
"""

import logging
import os
from typing import List

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from engines import get_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="Feedback AI Service",
    description="Microservice providing sentiment analysis, category classification, and keyword extraction.",
    version="1.1.0",
)

# ---------------------------------------------------------------------------
# Engine selection: driven exclusively by the SENTIMENT_ENGINE env var.
# Unknown values fail fast at startup with a clear message.
# ---------------------------------------------------------------------------
ENGINE_NAME = os.environ.get("SENTIMENT_ENGINE", "vader").strip().lower()
try:
    ENGINE = get_engine(ENGINE_NAME)
except ValueError as exc:
    logger.error("Invalid SENTIMENT_ENGINE configuration: %s", exc)
    raise

logger.info("Using sentiment engine: %s", ENGINE_NAME)


# Consistent JSON error handler for RequestValidationError
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    error_msg = first_error.get("msg", "Invalid request body")
    # Clean up standard pydantic prefixes if present
    if "Value error, " in error_msg:
        error_msg = error_msg.replace("Value error, ", "")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": error_msg}
    )


# Consistent JSON error handler for HTTPException
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )


class AnalyzeRequest(BaseModel):
    text: str = Field(
        ...,
        max_length=2000,
        description="The feedback comment text to analyze"
    )

    @field_validator("text")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Text cannot be empty or whitespace only")
        if len(v) > 2000:
            raise ValueError("Text cannot exceed 2000 characters")
        return v


class AnalyzeResponse(BaseModel):
    sentiment: str = Field(..., description="'positive', 'negative', or 'neutral'")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    category: str = Field(..., description="Assigned category name")
    keywords: List[str] = Field(..., description="Top meaningful keywords")


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """
    Analyzes feedback text with the active sentiment engine:
      1. Sentiment + confidence
      2. Category classification
      3. Keyword extraction (max 5)
    """
    clean_text = req.text.strip()

    result = ENGINE.analyze(clean_text)

    return AnalyzeResponse(
        sentiment=result.sentiment,
        confidence=result.confidence,
        category=result.category,
        keywords=result.keywords,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)