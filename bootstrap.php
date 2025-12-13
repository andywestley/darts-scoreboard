<?php

use Darts\Service\Logger;

// 0. Global Error and Exception Handling
ini_set('display_errors', 0); // Disable default HTML errors
error_reporting(E_ALL);

// Define a constant for the project root path early, as it's needed for the logger.
if (!defined('ROOT_PATH')) {
    define('ROOT_PATH', __DIR__);
}

// Manually include the Logger class so it can be used immediately.
require_once ROOT_PATH . '/src/Service/Logger.php';
$logger = new Logger(ROOT_PATH . '/app_log.txt', Logger::INFO);

set_exception_handler(function ($exception) {
    global $logger; // Make the logger available in this scope
    $logger->error('Uncaught Exception', ['message' => $exception->getMessage(), 'file' => $exception->getFile(), 'line' => $exception->getLine()]);
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
    global $logger; // Make the logger available in this scope
    if ($error) $logger->error('Fatal Error', $error);
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

// 1. Start the session.
// Even with a stateless JWT approach for gameplay, sessions are still used for the setup process.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// JWT Library - Manually included instead of using Composer
require_once ROOT_PATH . '/src/lib/php-jwt/JWTExceptionWithPayloadInterface.php';
require_once ROOT_PATH . '/src/lib/php-jwt/ExpiredException.php';
require_once ROOT_PATH . '/src/lib/php-jwt/SignatureInvalidException.php';
require_once ROOT_PATH . '/src/lib/php-jwt/BeforeValidException.php';
require_once ROOT_PATH . '/src/lib/php-jwt/JWK.php';
require_once ROOT_PATH . '/src/lib/php-jwt/JWT.php';
require_once ROOT_PATH . '/src/lib/php-jwt/Key.php';

// 3. Manually include all class files.
// This ensures that all classes are available for both web pages and API endpoints.
require_once ROOT_PATH . '/src/Data/Storage.php'; // Dependency
require_once ROOT_PATH . '/src/Controller/SetupController.php'; // Dependency
require_once ROOT_PATH . '/src/Controller/GameController.php'; // Dependency
require_once ROOT_PATH . '/src/Controller/StatsController.php'; // Dependency
require_once ROOT_PATH . '/src/App.php'; // Main App class, depends on the above
