"""
Keyword extraction module.
Lowercases text, strips punctuation and common English stopwords,
and returns the most frequent meaningful words.
"""

import re
from collections import Counter
from typing import List

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him",
    "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its",
    "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "she", "should", "shouldn't", "so",
    "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't",
    "what", "when", "where", "which", "while", "who", "whom", "why", "with",
    "won't", "would", "wouldn't", "you", "your", "yours", "yourself", "yourselves",
    # Additional common discourse/filler tokens
    "also", "really", "much", "even", "get", "got", "well", "one", "like", "make",
    "made", "way", "take", "lot", "bit", "day", "days", "time", "times"
}


def extract_keywords(text: str, max_keywords: int = 5) -> List[str]:
    """
    Extracts up to `max_keywords` most frequent meaningful words from text.

    Steps:
    1. Lowercase text and extract alphabetic words (length >= 3).
    2. Filter out English stopwords.
    3. Aggregate word frequencies.
    4. Return top words ordered by descending frequency.
    """
    if not text or not text.strip():
        return []

    # Find words with 3 or more letters (automatically removes punctuation and tiny tokens)
    tokens = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())

    # Remove stopwords
    filtered_tokens = [token for token in tokens if token not in STOPWORDS]

    if not filtered_tokens:
        return []

    # Count frequencies
    counts = Counter(filtered_tokens)

    # Return top N most common unique words
    top_words = [word for word, _ in counts.most_common(max_keywords)]
    return top_words
