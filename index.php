<?php

// 1. Error Reporting (for development)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 2. Bootstrap Application
session_start();

// 3. Render View
// The view file will handle displaying the correct screen based on session state.
require_once __DIR__ . '/public/index.php';

?>