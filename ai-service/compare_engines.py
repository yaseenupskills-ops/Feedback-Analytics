"""
Runs every analysis engine on the same 10 test comments and prints a side-by-side
comparison, so engine behaviour can be evaluated without code changes.

Usage:
    python compare_engines.py [engine ...]

Examples:
    python compare_engines.py vader llm
    SENTIMENT_ENGINE=huggingface python compare_engines.py huggingface
    LLM_API_URL=http://localhost:8001/v1/chat/completions LLM_API_KEY=test \
        python compare_engines.py llm

Results are also written to compare_engines_results.json.
"""

import json
import os
import sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engines import VALID_ENGINES, get_engine

# The same 10 comments used by the automated test suite.
SAMPLE_COMMENTS = [
    "Professor Smith delivers exceptionally clear lectures and engaging slides!",
    "Campus wifi is awful, disconnects constantly and bandwidth is terrible.",
    "The library building is open until 10 PM according to standard schedule.",
    "The newly renovated library study pods and comfortable desks are wonderful.",
    "The cafeteria lunch was undercooked, cold, and disgusting.",
    "The instructor is very polite and kind, but the exams are terribly unfair and harsh.",
    "Tuition fees and parking permit costs are exorbitantly overpriced and unfair.",
    "The IT helpdesk advisor resolved my computer ticket immediately with fantastic guidance.",
    "Front desk reception staff provided prompt, polite, and respectful assistance.",
    "A bird flew into the open courtyard window yesterday morning.",
]


def run_engine(name: str, comments):
    """Runs one engine over all comments; returns (comment -> result) mapping."""
    engine = get_engine(name)
    results = []
    for i, comment in enumerate(comments, start=1):
        try:
            result = engine.analyze(comment)
            results.append(result.to_dict())
        except Exception as exc:  # noqa: BLE001
            results.append({"sentiment": "ERROR", "confidence": 0.0, "category": str(exc), "keywords": []})
    return results


def print_comparison(engine_results: "OrderedDict[str, list]"):
    """Prints a readable per-comment comparison table."""
    comments = SAMPLE_COMMENTS
    for i, comment in enumerate(comments, start=1):
        print("=" * 100)
        print(f"#{i}: {comment}")
        print("-" * 100)
        header = f"{'ENGINE':<12} {'SENTIMENT':<9} {'CONF':>6}  {'CATEGORY':<10} KEYWORDS"
        print(header)
        print("-" * 100)
        for name, results in engine_results.items():
            r = results[i - 1]
            kws = ", ".join(r["keywords"]) if r["keywords"] else "-"
            print(
                f"{name:<12} {r['sentiment']:<9} {r['confidence']:>6.3f}  {r['category']:<10} {kws}"
            )
    print("=" * 100)


def main():
    engines = [e.strip().lower() for e in sys.argv[1:]] or list(VALID_ENGINES)
    for name in engines:
        if name not in VALID_ENGINES:
            print(f"Unknown engine '{name}'. Valid engines: {', '.join(VALID_ENGINES)}")
            sys.exit(2)

    engine_results = OrderedDict()
    for name in engines:
        print(f"\n>>> Running engine: {name}")
        engine_results[name] = run_engine(name, SAMPLE_COMMENTS)

    print("\n===================== COMPARISON =====================")
    print_comparison(engine_results)

    with open("compare_engines_results.json", "w") as fh:
        json.dump({"comments": SAMPLE_COMMENTS, "results": dict(engine_results)}, fh, indent=2)
    print(f"\nResults saved to compare_engines_results.json")


if __name__ == "__main__":
    main()