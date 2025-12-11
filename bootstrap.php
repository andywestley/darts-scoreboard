<?php

// 1. Start the session for all requests.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. Manually include all class files.
// This ensures that all classes are available for both web pages and API endpoints.
require_once __DIR__ . '/src/Data/Storage.php'; // Dependency
require_once __DIR__ . '/src/Controller/SetupController.php'; // Dependency
require_once __DIR__ . '/src/Controller/GameController.php'; // Dependency
require_once __DIR__ . '/src/Controller/StatsController.php'; // Dependency
require_once __DIR__ . '/src/App.php'; // Main App class, depends on the above