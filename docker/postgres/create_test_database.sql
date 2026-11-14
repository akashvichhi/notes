-- Runs once, when the database volume is first created: the API's tests use their own
-- database, so they never touch the app's data (api/tests/conftest.py).
CREATE DATABASE notes_test OWNER notes;
