import json
import logging
import os
import threading
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from queue import Queue

import redis
from redis.exceptions import RedisError

# 全局唯一标记，防止多进程/热重载重复创建 handler
_LOG_SETUP_FLAG = False
_LOG_CLEANUP_THREAD_FLAG = False
_LOG_MAX_BYTES = 6 * 1024 * 1024
_LOG_RETENTION_DAYS = 10
_LOG_CLEANUP_INTERVAL_SECONDS = 3600

class RedisLoggingHandler(logging.Handler):
    """生产安全版：异步非阻塞、自动重连、防递归、防重复"""
    def __init__(self, redis_url: str, channel: str = "aipc:logs", source: str = "backend"):
        super().__init__()
        self.redis_url = redis_url
        self.channel = channel
        self.source = source
        self.queue = Queue(maxsize=1000)
        self.redis_client = None
        self._last_key = None
        self._last_emit_monotonic = 0.0
        self._connect_redis()

        self.thread = threading.Thread(target=self._publisher_thread, daemon=True)
        self.thread.start()

    def _connect_redis(self):
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                socket_timeout=1.0,
                socket_connect_timeout=1.0,
                retry_on_timeout=False,
            )
        except RedisError:
            self.redis_client = None

    def _publisher_thread(self):
        while True:
            try:
                payload = self.queue.get()
                if self.redis_client is None:
                    self._connect_redis()
                if self.redis_client:
                    json_payload = json.dumps(payload, ensure_ascii=False)
                    # Cache last 1000 logs to prevent missing logs
                    self.redis_client.lpush(f"{self.channel}:history", json_payload)
                    self.redis_client.ltrim(f"{self.channel}:history", 0, 999)
                    # Publish to active subscribers
                    self.redis_client.publish(self.channel, json_payload)
            except Exception:
                pass

    def emit(self, record):
        try:
            msg = record.getMessage()
            if record.name.startswith("sqlalchemy.engine"):
                return
            key = (record.levelname, record.name, msg, self.source)
            now = time.monotonic()
            if key == self._last_key and (now - self._last_emit_monotonic) < 2:
                return
            self._last_key = key
            self._last_emit_monotonic = now
            payload = {
                "timestamp": datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S,%f")[:-3],
                "level": record.levelname,
                "name": record.name,
                "message": msg,
                "source": self.source
            }
            try:
                self.queue.put_nowait(payload)
            except Exception:
                pass
        except Exception:
            pass

def _get_log_dir() -> Path:
    base_dir = Path(__file__).resolve().parents[2]
    log_dir = base_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir

def _get_log_file_path(source: str) -> str:
    log_dir = _get_log_dir()
    filename = "aipc-backend-celery.log" if source == "worker" else "aipc-backend.log"
    return str((log_dir / filename).resolve())

def _cleanup_old_logs(log_dir: Path):
    cutoff = time.time() - (_LOG_RETENTION_DAYS * 24 * 3600)
    for p in log_dir.glob("aipc-backend*.log*"):
        try:
            if p.is_file() and p.stat().st_mtime < cutoff:
                p.unlink(missing_ok=True)
        except Exception:
            pass

def _start_log_cleanup_thread():
    global _LOG_CLEANUP_THREAD_FLAG
    if _LOG_CLEANUP_THREAD_FLAG:
        return
    log_dir = _get_log_dir()
    _cleanup_old_logs(log_dir)
    def _loop():
        while True:
            try:
                _cleanup_old_logs(log_dir)
            except Exception:
                pass
            time.sleep(_LOG_CLEANUP_INTERVAL_SECONDS)
    threading.Thread(target=_loop, daemon=True).start()
    _LOG_CLEANUP_THREAD_FLAG = True

def _should_attach_console_handler() -> bool:
    return not bool(os.getenv("INVOCATION_ID"))

def setup_redis_logging(redis_url: str, source: str = "backend"):
    global _LOG_SETUP_FLAG
    if _LOG_SETUP_FLAG:
        return None

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # 清空所有已有 handler，彻底避免重复/递归
    root_logger.handlers.clear()

    # 添加 Redis 日志
    redis_handler = RedisLoggingHandler(redis_url, source=source)
    redis_formatter = logging.Formatter("%(message)s")
    redis_handler.setFormatter(redis_formatter)
    root_logger.addHandler(redis_handler)

    # 添加文件日志
    log_file_path = _get_log_file_path(source)
    file_handler = RotatingFileHandler(
        log_file_path,
        maxBytes=_LOG_MAX_BYTES,
        backupCount=100,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s - %(message)s"
    )
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)

    console_handler = None
    if _should_attach_console_handler():
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(file_formatter)
        root_logger.addHandler(console_handler)

    # 绑定 uvicorn 日志
    if source == "backend":
        for logger_name in ("uvicorn.error", "uvicorn.access", "uvicorn"):
            logger = logging.getLogger(logger_name)
            logger.handlers.clear()
            logger.addHandler(file_handler)
            logger.addHandler(redis_handler)
            if console_handler is not None:
                logger.addHandler(console_handler)
            logger.setLevel(logging.INFO)
            logger.propagate = False

    _start_log_cleanup_thread()
    _LOG_SETUP_FLAG = True
    return redis_handler
