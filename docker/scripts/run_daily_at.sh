#!/bin/sh
# Runs a command every day at a fixed time: run_daily_at.sh HH:MM command [args...]
# A fixed time instead of "every 24 hours", so a restart or deploy never moves the
# schedule or adds a run. A failed run is logged and the loop waits for the next day.
set -eu

# The app's time zone, Asia/Kolkata (api/app/constants/time_constants.py), written as a
# POSIX rule: it has no daylight saving, and this works in images without tzdata.
APP_TIME_ZONE="IST-5:30"
SECONDS_PER_DAY=86400

case "${1:-}" in
    [0-2][0-9]:[0-5][0-9]) ;;
    *) echo "usage: run_daily_at.sh HH:MM command [args...]" >&2; exit 64 ;;
esac
run_at="$1"
shift

hour=${run_at%%:*}
minute=${run_at#*:}
target=$(( ${hour#0} * 3600 + ${minute#0} * 60 ))

seconds_until_next_run() {
    now=$(TZ="$APP_TIME_ZONE" date +%H:%M:%S)
    now_hour=${now%%:*}
    rest=${now#*:}
    now_minute=${rest%%:*}
    now_second=${rest#*:}
    elapsed=$(( ${now_hour#0} * 3600 + ${now_minute#0} * 60 + ${now_second#0} ))
    wait=$(( (target - elapsed + SECONDS_PER_DAY) % SECONDS_PER_DAY ))
    # 0 means "now": a run that just finished within the same second waits a day.
    echo $(( wait == 0 ? SECONDS_PER_DAY : wait ))
}

while true; do
    wait=$(seconds_until_next_run)
    echo "next run at $run_at in ${wait}s: $1"
    sleep "$wait"
    "$@" || echo "run failed with exit code $?: $1"
done
