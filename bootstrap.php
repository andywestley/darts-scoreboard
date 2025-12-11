<?php

// 0. Global Error and Exception Handling
ini_set('display_errors', 0); // Disable default HTML errors
error_reporting(E_ALL);

set_exception_handler(function ($exception) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Uncaught Exception',
        'message' => $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
    ]);
    exit;
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Fatal Error',
            'message' => $error['message'],
            'file' => $error['file'],
            'line' => $error['line'],
        ]);
    }
});

// 1. Start the session for all requests.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. Generate a CSRF token to prevent cross-site request forgery.
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// 3. Manually include all class files.
// This ensures that all classes are available for both web pages and API endpoints.
require_once __DIR__ . '/src/Data/Storage.php'; // Dependency
require_once __DIR__ . '/src/Controller/SetupController.php'; // Dependency
require_once __DIR__ . '/src/Controller/GameController.php'; // Dependency
require_once __DIR__ . '/src/Controller/StatsController.php'; // Dependency
require_once __DIR__ . '/src/App.php'; // Main App class, depends on the above