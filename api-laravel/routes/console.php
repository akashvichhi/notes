<?php

use App\Services\Auth\PruneExpiredAccessTokens;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('notes:prune-pats', function (PruneExpiredAccessTokens $prune) {
    $this->info('Pruned '.$prune().' expired personal access tokens.');
})->purpose('Delete expired personal access tokens');

Schedule::command('notes:prune-pats')->daily();
