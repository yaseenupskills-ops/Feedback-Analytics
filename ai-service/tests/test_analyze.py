"""
Unit and integration tests for Feedback AI Service.
Tests 10+ example comments across sentiments, categories, mixed inputs, and edge cases.
"""

import os
import sys

# Ensure ai-service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from main import app
from sentiment import analyze_sentiment
from categories import classify_category
from keywords import extract_keywords

client = TestClient(app)


# ==============================================================================
# Health Check Endpoint Test
# ==============================================================================

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ==============================================================================
# 10+ Example Comments Analyzed via POST /analyze
# ==============================================================================

def test_example_1_positive_teaching():
    payload = {"text": "Professor Smith delivers exceptionally clear lectures and engaging slides!"}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["confidence"] > 0.3
    assert data["category"] == "Teaching"
    assert "professor" in data["keywords"] or "lectures" in data["keywords"]


def test_example_2_negative_internet():
    payload = {"text": "Campus wifi is awful, disconnects constantly and bandwidth is terrible."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "negative"
    assert data["confidence"] > 0.4
    assert data["category"] == "Internet"
    assert "wifi" in data["keywords"]


def test_example_3_neutral_facilities():
    payload = {"text": "The library building is open until 10 PM according to standard schedule."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "neutral"
    assert data["category"] == "Facilities"
    assert "library" in data["keywords"]


def test_example_4_positive_facilities():
    payload = {"text": "The newly renovated library study pods and comfortable desks are wonderful."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["category"] == "Facilities"


def test_example_5_negative_food():
    payload = {"text": "The cafeteria lunch was undercooked, cold, and disgusting."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "negative"
    assert data["category"] == "Food"
    assert "cafeteria" in data["keywords"] or "lunch" in data["keywords"]


def test_example_6_mixed_sentiment_teaching():
    payload = {"text": "The instructor is very polite and kind, but the exams are terribly unfair and harsh."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Mixed sentence with contrasting polarities
    assert data["sentiment"] in ["negative", "positive", "neutral"]
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["category"] == "Teaching"


def test_example_7_negative_pricing():
    payload = {"text": "Tuition fees and parking permit costs are exorbitantly overpriced and unfair."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "negative"
    assert data["category"] == "Pricing"


def test_example_8_positive_support():
    payload = {"text": "The IT helpdesk advisor resolved my computer ticket immediately with fantastic guidance."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["category"] == "Support"


def test_example_9_positive_service():
    payload = {"text": "Front desk reception staff provided prompt, polite, and respectful assistance."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["category"] == "Service"


def test_example_10_fallback_other():
    payload = {"text": "A bird flew into the open courtyard window yesterday morning."}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    # No domain keywords match, fallback to 'Other'
    assert data["category"] == "Other"
    assert data["sentiment"] == "neutral"


# ==============================================================================
# Validation and Edge Cases Tests
# ==============================================================================

def test_empty_string_validation():
    payload = {"text": ""}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422
    assert "error" in response.json()


def test_whitespace_only_validation():
    payload = {"text": "    \n\t   "}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422
    assert "error" in response.json()


def test_exceeding_max_length_validation():
    payload = {"text": "a" * 2001}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422
    assert "error" in response.json()


def test_keywords_extraction_limit():
    text = "research paper methodology literature review data findings analysis discussion conclusion"
    keywords = extract_keywords(text, max_keywords=5)
    assert len(keywords) <= 5
    assert all(isinstance(k, str) for k in keywords)


def test_sentiment_confidence_clamping():
    sentiment, confidence = analyze_sentiment("Love it! Best experience ever in my entire life, absolutely stellar!")
    assert sentiment == "positive"
    assert 0.0 <= confidence <= 1.0
