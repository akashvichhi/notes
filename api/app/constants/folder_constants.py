FOLDER_NAME_MAX_LENGTH = 120
FOLDER_COLOR_LENGTH = 7
# The colour picker's format: "#" and six hex digits.
FOLDER_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
# Positions are a Postgres integer.
FOLDER_POSITION_MIN = -(2**31)
FOLDER_POSITION_MAX = 2**31 - 1
# A child folder moved up next to a same-named folder becomes "Name (2)", "Name (3)", ...
FIRST_DUPLICATE_SUFFIX_NUMBER = 2
