#!/bin/sh
# The scheduler container's entry point: removes expired sessions and tokens once a day.
set -eu

SECONDS_PER_DAY=86400

while true; do
    python -m scripts.prune_expired
    sleep "$SECONDS_PER_DAY"
done
