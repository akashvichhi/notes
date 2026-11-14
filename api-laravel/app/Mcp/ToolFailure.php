<?php

namespace App\Mcp;

use RuntimeException;

/** A tool error whose message is written for Claude and safe to show. */
class ToolFailure extends RuntimeException {}
