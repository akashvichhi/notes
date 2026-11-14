# ICU collation that ignores case and accents ("Café" = "cafe"), so emails, names and
# titles match the way people read them. Created by the first migration.
CASE_INSENSITIVE_COLLATION = "case_insensitive"
CASE_INSENSITIVE_ICU_LOCALE = "und-u-ks-level1"

# The text search configuration for note search: no stemming and no stop words, so
# prefix search on any word works whatever the note's language.
SEARCH_TEXT_CONFIG = "simple"
