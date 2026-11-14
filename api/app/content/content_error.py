class ContentError(ValueError):
    """Markdown that cannot become a note body. The message is safe to show the caller."""
