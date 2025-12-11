<?php

use Darts\App;

// Bootstrap the application
ini_set('display_errors', 1); // Ensure API errors are reported during dev
require_once __DIR__ . '/bootstrap.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Handle the session reset action separately as it involves a redirect.
if ($action === 'reset') {
    session_destroy();
    header('Location: /');
    exit;
}

$app = new App();
$app->run();