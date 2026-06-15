"""Utility helper functions."""

import hashlib
import json


def compute_hash(content: str) -> str:
    """Compute SHA-256 hash for deduplication."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def safe_json_loads(data, default=None):
    """Safely parse JSON string, return default on failure."""
    if data is None:
        return default
    if isinstance(data, (dict, list)):
        return data
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return default
