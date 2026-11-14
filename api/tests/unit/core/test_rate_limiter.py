import pytest

from app.core.exceptions import RateLimitedError
from app.core.rate_limiter import RateLimit, RateLimiter
from tests.fakes import START_TIME, FakeClock

FIVE_PER_MINUTE = RateLimit(max_attempts=5, window_seconds=60)


def test_allows_the_limit_then_rejects_with_the_wait_time() -> None:
    clock = FakeClock(START_TIME)
    limiter = RateLimiter(clock)
    for _ in range(5):
        limiter.hit("login:ip", FIVE_PER_MINUTE)

    clock.advance(seconds=20)
    with pytest.raises(RateLimitedError) as error:
        limiter.hit("login:ip", FIVE_PER_MINUTE)

    assert error.value.retry_after_seconds == 40


def test_window_resets_after_it_ends() -> None:
    clock = FakeClock(START_TIME)
    limiter = RateLimiter(clock)
    for _ in range(5):
        limiter.hit("login:ip", FIVE_PER_MINUTE)

    clock.advance(seconds=61)

    limiter.hit("login:ip", FIVE_PER_MINUTE)


def test_keys_are_counted_separately() -> None:
    limiter = RateLimiter(FakeClock(START_TIME))
    for _ in range(5):
        limiter.hit("login:a", FIVE_PER_MINUTE)

    limiter.hit("login:b", FIVE_PER_MINUTE)


def test_check_rejects_without_counting_and_clear_forgets() -> None:
    limiter = RateLimiter(FakeClock(START_TIME))
    for _ in range(5):
        limiter.hit("failures:email", FIVE_PER_MINUTE)

    with pytest.raises(RateLimitedError):
        limiter.check("failures:email", FIVE_PER_MINUTE)

    limiter.clear("failures:email")
    limiter.check("failures:email", FIVE_PER_MINUTE)


def test_check_on_an_unknown_key_passes() -> None:
    RateLimiter(FakeClock(START_TIME)).check("never-seen", FIVE_PER_MINUTE)
