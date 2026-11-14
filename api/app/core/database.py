from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.constants.time_constants import APP_TIME_ZONE_NAME


def create_database_engine(database_url: str) -> Engine:
    return create_engine(
        database_url,
        # pre_ping drops connections Postgres closed while idle, instead of failing a request.
        pool_pre_ping=True,
        # Bound values are emails, note text and hashes; without this, every database
        # error's text carries them into the logs.
        hide_parameters=True,
        # The session zone decides the offset of every timestamptz Postgres returns, so it
        # must be the app's zone, never the server's default.
        connect_args={"options": f"-c timezone={APP_TIME_ZONE_NAME}"},
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    # Services read attributes after commit to build resources; expiring them would
    # trigger a reload query per attribute.
    return sessionmaker(bind=engine, expire_on_commit=False)


def get_db_session(request: Request) -> Iterator[Session]:
    """One session per request. Services commit; anything uncommitted is rolled back on close."""
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    with session_factory() as session:
        yield session
