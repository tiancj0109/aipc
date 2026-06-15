"""AES-256 encryption utilities for API key storage."""

import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import get_settings


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the configured encryption key."""
    settings = get_settings()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"aipc-salt-v1",
        iterations=480000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.ENCRYPTION_KEY.encode()))
    return Fernet(key)


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt an API key for storage."""
    if not plain_key:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key."""
    if not encrypted_key:
        return ""
    f = _get_fernet()
    return f.decrypt(encrypted_key.encode()).decode()
