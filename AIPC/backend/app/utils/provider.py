def normalize_provider(provider: str | None) -> str:
    value = (provider or "").strip().lower()
    aliases = {
        "openai-compatible": "openai",
        "openai_compatible": "openai",
        "qwen": "aliyun",
        "tongyi": "aliyun",
        "kimi": "moonshot",
        "local_model": "local",
    }
    return aliases.get(value, value)


def resolve_adapter_provider(provider: str | None) -> str:
    normalized = normalize_provider(provider)
    openai_compatible = {"openai", "deepseek", "aliyun", "moonshot", "other"}
    if normalized in openai_compatible:
        return "openai"
    if normalized == "anthropic":
        return "anthropic"
    if normalized in {"ollama", "local"}:
        return "ollama"
    return "openai"
