<?php

use Darts\App;

// Bootstrap the application
session_start();

// Include the main App class
require_once __DIR__ . '/src/App.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Handle the session reset action separately as it involves a redirect.
if ($action === 'reset') {
    session_destroy();
    header('Location: /');
    exit;
}

$app = new App();
$app->run();