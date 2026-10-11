"""
Tests for the pluggable analysis engines (vader | huggingface | llm).

The HF model tests are gated behind RUN_HF_TESTS=1 because loading the pretrained
models downloads several hundred MB. The pure helper functions are always tested.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest

from engines import get_engine, VALID_ENGINES
from engines.base import CATEGORIES, AnalysisResult, VALID_SENTIMENTS, normalize_category
from engines import vader as vader_engine
from engines import llm as llm_engine
from engines import huggingface as hf_engine

TEXT = "The cafeteria lunch was undercooked, cold, and disgusting."


def make_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), timeout=10)


def valid_llm_handler(request: httpx.Request) -> httpx.Response:
    payload = (
        f'{{"sentiment": "negative", "confidence": 0.93, '
        f'"category": "Food", "keywords": ["cafeteria", "undercooked"]}}'
    )
    return httpx.Response(
        200,
        json={"choices": [{"message": {"role": "assistant", "content": payload}}]},
    )


# ==============================================================================
# Factory
# ==============================================================================

def test_valid_engines_list():
    assert VALID_ENGINES == ("vader", "huggingface", "llm")


@pytest.mark.parametrize("name", ["vader", "huggingface", "llm", "VADER", " LlM "])
def test_get_engine_accepts_known_names(name):
    engine = get_engine(name)
    assert hasattr(engine, "analyze")
    assert engine.ENGINE_NAME in VALID_ENGINES


def test_get_engine_rejects_unknown_name():
    with pytest.raises(ValueError):
        get_engine("dalle")


# ==============================================================================
# Shared contract
# ==============================================================================

def _assert_contract(result: AnalysisResult):
    assert result.sentiment in VALID_SENTIMENTS
    assert 0.0 <= result.confidence <= 1.0
    assert result.category in CATEGORIES
    assert isinstance(result.keywords, list)
    assert len(result.keywords) <= 5


def test_normalize_category():
    assert normalize_category("internet") == "Internet"
    assert normalize_category("Pricing") == "Pricing"
    assert normalize_category("") == "Other"
    assert normalize_category("42") == "Other"
    assert normalize_category(None) == "Other"


def test_vader_engine_contract():
    result = vader_engine.analyze(TEXT)
    _assert_contract(result)
    assert result.sentiment == "negative"
    assert result.category == "Food"


# ==============================================================================
# LLM engine
# ==============================================================================

def test_llm_engine_happy_path():
    result = llm_engine.analyze(TEXT, client=make_client(valid_llm_handler))
    _assert_contract(result)
    assert result.sentiment == "negative"
    assert result.category == "Food"
    assert result.keywords == ["cafeteria", "undercooked"]


def test_llm_engine_prompt_contains_categories():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.read().decode()
        return valid_llm_handler(request)

    client = make_client(handler)
    llm_engine.analyze(TEXT, client=client)
    body = captured["body"]
    assert '"model"' in body
    assert "Teaching" in body and "Support" in body and "Other" in body
    assert "only valid json" in body.lower()


def test_llm_engine_code_fence_json_parsed():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = (
            "```json\n"
            '{"sentiment": "positive", "confidence": 0.81, '
            '"category": "Support", "keywords": ["helpdesk", "support"]}\n'
            "```"
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

    result = llm_engine.analyze(
        "The IT helpdesk resolved my ticket with fantastic support.",
        client=make_client(handler),
    )
    assert result.sentiment == "positive"
    assert result.category == "Support"
    assert "helpdesk" in result.keywords


def test_llm_engine_invalid_list_of_categories():
    # Category left off the canonical list is coerced to Other; everything else stays valid.
    def handler(request: httpx.Request) -> httpx.Response:
        payload = (
            '{"sentiment": "neutral", "confidence": 0.5, '
            '"category": "Cafeteria", "keywords": ["cafeteria"]}'
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

    result = llm_engine.analyze(TEXT, client=make_client(handler))
    assert result.category == "Other"


def test_llm_engine_keywords_grounded_in_text():
    # LLM asks for a keyword that is not in the comment -> keyword extraction fallback.
    def handler(request: httpx.Request) -> httpx.Response:
        payload = (
            '{"sentiment": "negative", "confidence": 0.9, '
            '"category": "Food", "keywords": ["zebras", "rocketship"]}'
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

    result = llm_engine.analyze(TEXT, client=make_client(handler))
    assert result.sentiment == "negative"
    assert "zebras" not in result.keywords
    assert result.category == "Food"


def test_llm_engine_falls_back_on_http_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    text = "Tution costs at this university are way too high for students."
    result = llm_engine.analyze(text, client=make_client(handler))
    # Fallback result equals the VADER engine's output for the same text.
    assert result == vader_engine.analyze(text)


def test_llm_engine_falls_back_on_invalid_json():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = "This is not JSON at all, sorry."
        return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

    result = llm_engine.analyze(TEXT, client=make_client(handler))
    assert result == vader_engine.analyze(TEXT)


def test_llm_engine_falls_back_on_poor_shape():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = '{"confidence": -0.4, "keywords": "nope"}'
        return httpx.Response(200, json={"choices": [{"message": {"content": payload}}]})

    result = llm_engine.analyze(TEXT, client=make_client(handler))
    assert result == vader_engine.analyze(TEXT)


def test_llm_engine_falls_back_on_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated timeout")

    result = llm_engine.analyze(TEXT, client=make_client(handler))
    assert result == vader_engine.analyze(TEXT)


# ==============================================================================
# Hugging Face engine (pure helpers always tested; models behind RUN_HF_TESTS=1)
# ==============================================================================

@pytest.mark.parametrize(
    "prob_positive,expected_sentiment",
    [
        (0.99, "positive"),
        (0.75, "positive"),
        (0.52, "neutral"),
        (0.50, "neutral"),
        (0.48, "neutral"),
        (0.10, "negative"),
        (0.01, "negative"),
    ],
)
def test_hf_sentiment_from_probability(prob_positive, expected_sentiment):
    sentiment, confidence = hf_engine._sentiment_from_probability(prob_positive)
    assert sentiment == expected_sentiment
    assert 0.0 <= confidence <= 1.0


def test_hf_sentiment_polarity_symmetric():
    pos_s, pos_c = hf_engine._sentiment_from_probability(0.9)
    neg_s, neg_c = hf_engine._sentiment_from_probability(0.1)
    assert pos_s == "positive" and neg_s == "negative"
    assert round(pos_c, 3) == round(neg_c, 3)


@pytest.mark.skipif(
    os.environ.get("RUN_HF_TESTS") != "1",
    reason="Set RUN_HF_TESTS=1 to download models and run the real HF pipeline tests.",
)
def test_hf_engine_contract_real_models():
    result = hf_engine.analyze("The research library is lovely and the staff are great.")
    _assert_contract(result)
    assert result.sentiment == "positive"
    assert result.category in CATEGORIES