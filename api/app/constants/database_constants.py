# ICU collation that ignores case and accents ("Café" = "cafe"), like the MySQL
# utf8mb4_0900_ai_ci columns the data came from. Created by the first migration.
CASE_INSENSITIVE_COLLATION = "case_insensitive"
CASE_INSENSITIVE_ICU_LOCALE = "und-u-ks-level1"

# The text search configuration for note search: no stemming and no stop words, so
# prefix search on any word works whatever the note's language.
SEARCH_TEXT_CONFIG = "simple"
