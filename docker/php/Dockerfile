# The whole app as images (decision 5): the React build, the Laravel API on
# PHP-FPM, and Caddy serving both. Built from the repo root by docker-compose.yml.

FROM node:26.13.0-bookworm-slim AS frontend
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Vite writes into Laravel's public folder (decision 2), so it has to exist here.
COPY api/public/ ../api/public/
RUN npm run build:prod

FROM php:8.5.11-fpm-bookworm AS app
RUN apt-get update && apt-get install -y --no-install-recommends unzip libzip-dev libicu-dev \
    && docker-php-ext-install pdo_mysql zip bcmath intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2.9.7 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
# Dependencies first, so a code change doesn't reinstall them.
COPY api/composer.json api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY api/ ./
COPY --from=frontend /src/api/public/ ./public/
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && chown -R www-data:www-data storage bootstrap/cache
COPY --chmod=755 docker/php/start.sh /usr/local/bin/start-app
# Everything runs as www-data, so the scheduler and PHP-FPM can both write
# the logs and caches in storage/.
USER www-data
CMD ["start-app"]

FROM caddy:2.11.6-alpine AS web
COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=app /var/www/html/public /var/www/html/public
