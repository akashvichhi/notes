<?php

namespace App\Support\Content;

use InvalidArgumentException;

/** Markdown that cannot become a note body — the message is safe to show the caller. */
class ContentException extends InvalidArgumentException {}
