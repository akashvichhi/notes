# PHP 8.3 CLI with everything Laravel 12 needs, plus Composer.
FROM php:8.3-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libicu-dev default-mysql-client \
    && docker-php-ext-install pdo_mysql zip bcmath intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
