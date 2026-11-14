# Sign-in and sign-up attempts per IP address per minute.
AUTH_ATTEMPTS_PER_IP = 5
# Failed sign-ins per email address per minute, whatever the IP.
FAILED_LOGINS_PER_EMAIL = 5
RATE_LIMIT_WINDOW_SECONDS = 60

# A session's expiry is pushed forward at most this often, so a busy user does not
# cost a database write and a new cookie on every request.
SESSION_REFRESH_INTERVAL_HOURS = 24

# Used when no client address is known (tests, unix sockets).
UNKNOWN_CLIENT_ADDRESS = "unknown"
