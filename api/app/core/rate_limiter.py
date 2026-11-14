"""Fixed-window attempt counters, kept in memory. That is why the API runs one worker:
a second process would have its own counters."""

import math
import threading
from dataclasses import dataclass

from app.core.clock import Clock
from app.core.exceptions import RateLimitedError

# Expired windows are swept once the table grows past this, so memory stays bounded.
SWEEP_THRESHOLD = 10_000


@dataclass(frozen=True)
class RateLimit:
    max_attempts: int
    window_seconds: int


@dataclass
class _Window:
    started_at: float
    window_seconds: int
    attempts: int = 0

    def has_ended(self, now: float) -> bool:
        return now - self.started_at >= self.window_seconds


class RateLimiter:
    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._windows: dict[str, _Window] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: RateLimit) -> None:
        """Counts an attempt; raises RateLimitedError when the limit is already used up."""
        with self._lock:
            window = self._current_window(key, limit)
            self._raise_if_full(window, limit)
            window.attempts += 1

    def check(self, key: str, limit: RateLimit) -> None:
        """Raises RateLimitedError when the limit is used up, without counting an attempt."""
        with self._lock:
            self._raise_if_full(self._current_window(key, limit), limit)

    def clear(self, key: str) -> None:
        with self._lock:
            self._windows.pop(key, None)

    def _current_window(self, key: str, limit: RateLimit) -> _Window:
        now = self._now()
        window = self._windows.get(key)
        if window is None or window.has_ended(now):
            if len(self._windows) > SWEEP_THRESHOLD:
                self._sweep(now)
            window = _Window(started_at=now, window_seconds=limit.window_seconds)
            self._windows[key] = window
        return window

    def _raise_if_full(self, window: _Window, limit: RateLimit) -> None:
        if window.attempts < limit.max_attempts:
            return
        retry_after = window.started_at + window.window_seconds - self._now()
        raise RateLimitedError(retry_after_seconds=max(1, math.ceil(retry_after)))

    def _sweep(self, now: float) -> None:
        expired = [key for key, window in self._windows.items() if window.has_ended(now)]
        for key in expired:
            del self._windows[key]

    def _now(self) -> float:
        return self._clock.now().timestamp()
