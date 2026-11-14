#!/bin/sh
# Runs on every start of the app container, so a new image migrates the
# database and rebuilds Laravel's caches before it serves requests.
set -e

php artisan migrate --force
php artisan optimize
exec php-fpm
