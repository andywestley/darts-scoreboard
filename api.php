<?php

use Darts\App;

// Bootstrap the application
session_start();

// Manually include all necessary class files.
// This makes them available globally before the App is instantiated.
require_once __DIR__ . '/src/App.php';
require_once __DIR__ . '/src/Data/Storage.php';
require_once __DIR__ . '/src/Controller/SetupController.php';
require_once __DIR__ . '/src/Controller/GameController.php';
require_once __DIR__ . '/src/Controller/StatsController.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Handle the session reset action separately as it involves a redirect.
if ($action === 'reset') {
    session_destroy();
    header('Location: /');
    exit;
}

$app = new App();
$app->run();