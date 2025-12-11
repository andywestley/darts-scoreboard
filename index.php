<?php

// Temporarily display all PHP errors to diagnose any underlying issues.
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Manually include the core application logic and class files.
require_once __DIR__ . '/api.php';

// Now that the environment is set up, render the main HTML view.
require_once __DIR__ . '/public/index.php';

?>