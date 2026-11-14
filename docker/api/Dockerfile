# The whole app as one image (decision 10): the React build, served by the FastAPI API.
# Built from the repo root by docker-compose.yml.

FROM node:26.13.0-bookworm-slim AS web_build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.14.3-slim-bookworm AS app
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
# The virtual environment lives outside the code folder, so copying the code never
# overwrites it, and its bin/ comes first on PATH.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app/api
# Dependencies first, so a code change doesn't reinstall them.
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY api/ ./
RUN uv sync --frozen --no-dev
COPY --from=web_build /src/web/dist /app/web/dist
RUN useradd --system --no-create-home notes
USER notes
CMD ["sh", "scripts/start.sh"]
