"""
LLM engine.

Calls any OpenAI-compatible `/chat/completions` endpoint and asks it to return
strict JSON of the exact API contract shape:

    {"sentiment": "...", "confidence": 0.0, "category": "...", "keywords": [...]}

Behaviour:
- Input validation  : the model response is parsed and every field is validated
  (sentiment enum, confidence 0..1, category canonicalized, keywords capped).
  Invalid responses are treated as a failure.
- Timeout           : every request is subject to `LLM_TIMEOUT` (seconds, default 10).
- Fallback          : if the API call fails for ANY reason (network, HTTP error,
  timeout, malformed or invalid JSON), the analysis falls back to the VADER +
  keyword-rule engine so the service never hard-fails.

Environment variables:
    LLM_API_URL   (default https://api.openai.com/v1/chat/completions)
    LLM_API_KEY   (sent as `Authorization: Bearer <key>` if provided)
    LLM_MODEL     (default gpt-4o-mini)
    LLM_TIMEOUT   (seconds, default 10)
"""

import json
import logging
import os
from typing import Any, Optional

import httpx

from engines.base import AnalysisResult, CATEGORIES, VALID_SENTIMENTS, normalize_category
from engines.vader import analyze as vader_fallback

logger = logging.getLogger("ai-service.llm")

ENGINE_NAME = "llm"

DEFAULT_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT = 10.0
MAX_KEYWORDS = 5

_SYSTEM_PROMPT = (
    "You are a strict JSON-only feedback analysis assistant. "
    "Never include prose, markdown, or code fences in your reply."
)

_USER_PROMPT = """Analyze the sentiment, confidence, category, and keywords of the following feedback comment.

Rules:
- "sentiment" must be exactly one of: positive, neutral, negative
- "confidence" must be a number between 0.0 and 1.0
- "category" must be exactly one of: {categories}
- "keywords" must be an array of up to {max_keywords} short keyword strings found verbatim (or nearly verbatim) in the comment

Respond with ONLY valid JSON and nothing else, in this exact shape:
{{"sentiment": "...", "confidence": 0.0, "category": "...", "keywords": ["..."]}}

Comment: {text}"""


def _user_prompt(text: str) -> str:
    return _USER_PROMPT.format(
        categories=", ".join(CATEGORIES),
        max_keywords=MAX_KEYWORDS,
        text=text,
    )


def _parse_model_json(content: str) -> dict:
    """Extracts a JSON object from the model's reply, tolerating code fences."""
    cleaned = (content or "").strip()
    # Strip markdown code fences (```json ... ```).
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        lines = cleaned.splitlines()
        if lines and "json" in lines[0].lower():
            lines = lines[1:]
        cleaned = "\n".join(lines).strip()
    if not cleaned:
        raise ValueError("LLM returned an empty response")
    return json.loads(cleaned)


def _validate_and_build(data: dict, text: str) -> AnalysisResult:
    """Validates the model's JSON and canonicalizes it into an AnalysisResult."""
    sentiment = str(data.get("sentiment", "")).strip().lower()
    if sentiment not in VALID_SENTIMENTS:
        raise ValueError(f"Invalid sentiment from LLM: {sentiment!r}")

    confidence = float(data.get("confidence"))
    if not (0.0 <= confidence <= 1.0):
        raise ValueError(f"Confidence out of range: {confidence}")

    category = normalize_category(data.get("category", "Other"))

    keywords_raw = data.get("keywords", [])
    if not isinstance(keywords_raw, list):
        raise ValueError("keywords must be a JSON array")

    keywords = []
    for kw in keywords_raw:
        word = str(kw).strip()
        if word:
            keywords.append(word)
    keywords = keywords[:MAX_KEYWORDS]

    return AnalysisResult(
        sentiment=sentiment,
        confidence=round(confidence, 3),
        category=category,
        keywords=keywords,
    )


def _call_llm(client: httpx.Client, api_url: str, api_key: str, model: str, text: str) -> AnalysisResult:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body = {
        "model": model,
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(text)},
        ],
    }

    response = client.post(api_url, headers=headers, json=body)
    response.raise_for_status()

    payload = response.json()
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("LLM response missing choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    data = _parse_model_json(content)
    result = _validate_and_build(data, text)
    if result.keywords and not _keywords_overlap(result.keywords, text):
        # Guard against keyword hallucination: LLM must ground keywords in the text.
        logger.warning("LLM keywords not found in comment; falling back to extraction.")
        from keywords import extract_keywords

        result = AnalysisResult(
            sentiment=result.sentiment,
            confidence=result.confidence,
            category=result.category,
            keywords=extract_keywords(text, max_keywords=MAX_KEYWORDS),
        )
    return result


def _keywords_overlap(keywords, text: str) -> bool:
    lowered = text.lower()
    return any(kw.lower() in lowered for kw in keywords)


def analyze(text: str, client: Optional[httpx.Client] = None) -> AnalysisResult:
    """
    Analyze `text` via the configured LLM API.

    `client` may be injected for testing (e.g. httpx.MockTransport); otherwise a
    real client with the configured timeout is created per call.
    """
    api_url = os.environ.get("LLM_API_URL", DEFAULT_API_URL)
    api_key = os.environ.get("LLM_API_KEY", "")
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)
    try:
        timeout = float(os.environ.get("LLM_TIMEOUT", DEFAULT_TIMEOUT))
    except ValueError:
        timeout = DEFAULT_TIMEOUT

    owns_client = client is None
    if owns_client:
        client = httpx.Client(timeout=timeout)

    try:
        return _call_llm(client, api_url, api_key, model, text)
    except Exception as exc:  # noqa: BLE001 - any failure must trigger the fallback
        logger.warning(
            "LLM analysis failed (%s: %s); falling back to VADER + keyword engine.",
            type(exc).__name__,
            exc,
        )
        return vader_fallback(text)
    finally:
        if owns_client:
            client.close()