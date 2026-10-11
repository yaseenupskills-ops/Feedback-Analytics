"""
Category classification module using keyword-rule matching.
The dictionary is cleanly decoupled so categories and their keywords
can be easily expanded or substituted with ML classifiers.
"""

import re
from typing import Dict, List

# Extensible dictionary mapping categories to indicator keywords
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Teaching": [
        "professor", "prof", "teacher", "lecture", "lectures", "class", "classes",
        "syllabus", "slides", "instructor", "teaching", "ta", "assignment",
        "assignments", "exam", "exams", "quiz", "homework", "curriculum",
        "grading", "course", "courses", "explanation", "pedagogy", "faculty",
        "lesson", "learn", "learning"
    ],
    "Facilities": [
        "library", "classroom", "building", "hall", "desk", "desks",
        "chair", "chairs", "restroom", "bathroom", "air conditioning",
        "ac", "elevator", "parking", "campus", "lab", "laboratory",
        "clean", "cleaning", "maintenance", "noise", "lighting", "bench",
        "pods", "pod", "gym", "dorm", "dormitory", "water fountain"
    ],
    "Food": [
        "cafeteria", "food", "lunch", "dinner", "breakfast", "meal",
        "meals", "coffee", "cafe", "snack", "snacks", "drink", "drinks",
        "salad", "chicken", "diet", "vegan", "vegetarian", "canteen",
        "taste", "hygiene", "portion", "cook", "cooking", "beverage"
    ],
    "Internet": [
        "wifi", "wi-fi", "internet", "connection", "network", "bandwidth",
        "disconnect", "signal", "ethernet", "router", "speed", "latency",
        "drops", "drop", "lag", "ping", "connectivity", "online"
    ],
    "Service": [
        "service", "reception", "front desk", "counter",
        "registrar", "administration", "admin", "clerk", "wait time",
        "queue", "response time", "office hours", "polite", "rude",
        "staff", "bureaucracy", "efficiency", "attitude"
    ],
    "Pricing": [
        "fee", "fees", "price", "prices", "tuition", "cost", "costs",
        "expensive", "cheap", "overpriced", "affordable", "rate", "rates",
        "payment", "installment", "bill", "billing", "refund", "financial",
        "dollar", "money", "scholarship", "value"
    ],
    "Support": [
        "helpdesk", "help desk", "it support", "support", "advisor",
        "counselor", "counseling", "guidance", "ticket", "assistance",
        "mentor", "advising", "mental health", "wellness", "career services",
        "adviser", "troubleshoot", "counsel"
    ],
    "Other": []
}


def classify_category(text: str) -> str:
    """
    Classifies input text into one of the predefined categories
    by counting keyword hits.

    Returns the category with the most keyword occurrences.
    If no category has any keyword hits, falls back to 'Other'.
    """
    if not text or not text.strip():
        return "Other"

    text_lower = text.lower()
    category_scores: Dict[str, int] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        if category == "Other":
            continue

        score = 0
        for keyword in keywords:
            # Handle multi-word phrases vs single words
            pattern = r'\b' + re.escape(keyword) + r'\b'
            matches = len(re.findall(pattern, text_lower))
            score += matches

        category_scores[category] = score

    # Find category with maximum score
    best_category, max_score = max(category_scores.items(), key=lambda item: item[1])

    # Fall back to "Other" if no keywords were matched
    if max_score == 0:
        return "Other"

    return best_category
