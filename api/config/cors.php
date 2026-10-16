<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        'https://notes.codespan.in',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost',
        'tauri://localhost',
        'https://tauri.localhost',
        'http://tauri.localhost',
    ]))),
    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?$#',
        '#^tauri://localhost$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['*'],
    'max_age' => 0,
    'supports_credentials' => true,
];

