<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Send the next requests from the web app, so Sanctum starts a session for
     * them. The origin comes from the config, which differs between machines.
     */
    protected function fromBrowser(): static
    {
        return $this->withHeader('Origin', 'http://'.config('sanctum.stateful')[0]);
    }
}
