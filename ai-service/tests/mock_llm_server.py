"""
Dev-only mock of an OpenAI-compatible /chat/completions endpoint.

Returns strict JSON built with the deterministic VADER + keyword classifier, so
the LLM engine's full pipeline (prompt -> HTTP -> JSON parsing/validation) can be
exercised end-to-end without a paid API key. Comments are extracted from the
request's last user message.

Run (from the ai-service directory):
    python -m uvicorn tests.mock_llm_server:app --port 8001

Then point the LLM engine at it:
    LLM_API_URL=http://localhost:8001/v1/chat/completions LLM_API_KEY=test
"""

import json
import re

from fastapi import FastAPI
from pydantic import BaseModel, Field

from categories import classify_category
from keywords import extract_keywords
from sentiment import analyze_sentiment

app = FastAPI(title="Mock LLM Server (for local testing)")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = Field(default="mock-model")
    messages: list[Message] = Field(default_factory=list)


@app.post("/v1/chat/completions")
def chat_completions(req: ChatRequest):
    # The final user message contains the comment (after the prompt template).
    user_content = req.messages[-1].content if req.messages else ""
    match = re.search(r"Comment: (.+?)\s*$", user_content, re.DOTALL)
    text = match.group(1).strip() if match else user_content.strip()

    sentiment, confidence = analyze_sentiment(text)
    category = classify_category(text)
    keywords = extract_keywords(text, max_keywords=5)

    payload = json.dumps(
        {
            "sentiment": sentiment,
            "confidence": confidence,
            "category": category,
            "keywords": keywords,
        }
    )

    return {
        "id": "chatcmpl-mock",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": payload}}],
    }