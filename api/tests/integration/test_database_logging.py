import logging

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError

from app.core import exception_handlers

PERSONAL_TEXT = "asha@example.com"


def test_a_failed_statement_is_logged_without_its_parameters(
    engine: Engine, caplog: pytest.LogCaptureFixture
) -> None:
    """The handler for unexpected errors logs the exception; its text must not carry the
    values bound to the statement, which can be emails, note text or hashes."""
    with engine.connect() as connection, pytest.raises(DBAPIError) as failure:
        # Division by zero: Postgres's own message names no value, so only the bound
        # parameters could leak it.
        connection.execute(text("SELECT CAST(:value AS text), 1 / 0"), {"value": PERSONAL_TEXT})

    with caplog.at_level(logging.ERROR, logger=exception_handlers.logger.name):
        exception_handlers.logger.error("Unhandled error", exc_info=failure.value)

    assert caplog.records
    assert PERSONAL_TEXT not in caplog.text
