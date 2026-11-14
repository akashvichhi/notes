API_PATH_PREFIX = "/api"
API_V1_PREFIX = "/api/v1"
MCP_PATH = "/mcp"
ASSETS_PATH_PREFIX = "/assets"

# Methods that change data; the origin check applies to these only.
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
PAGE_METHODS = frozenset({"GET", "HEAD"})

# Responses smaller than this are not worth compressing.
GZIP_MINIMUM_BYTES = 1000

CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable"
CACHE_CONTROL_NO_CACHE = "no-cache"
INDEX_FILE_NAME = "index.html"
