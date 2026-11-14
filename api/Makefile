.PHONY: check lint format typecheck test

check: lint format typecheck test

lint:
	uv run ruff check --fix .

format:
	uv run ruff format .

typecheck:
	uv run mypy app tests scripts

# The coverage threshold lives here, not in pytest's default options,
# so running a single test file doesn't fail on coverage.
test:
	uv run pytest --cov --cov-report=term-missing --cov-fail-under=90
