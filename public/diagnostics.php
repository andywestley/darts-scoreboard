<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

function run_diagnostics() {
    // --- Test 1: File System Permissions ---
    echo "<h2>1. File System Permissions Test</h2>";
    $dataDir = __DIR__ . '/../data';
    $testFile = $dataDir . '/permission_test.tmp';
    $testContent = 'write_test_' . time();
    $results = [];

    // Check if data directory exists
    if (is_dir($dataDir)) {
        $results[] = ['PASS', 'Data directory exists.', $dataDir];
    } else {
        $results[] = ['FAIL', 'Data directory does not exist.', $dataDir];
    }

    // Check if data directory is writable
    if (is_writable($dataDir)) {
        $results[] = ['PASS', 'Data directory is writable.'];
    } else {
        $results[] = ['FAIL', 'Data directory is NOT writable. Please check permissions.'];
    }

    // Attempt to write a file
    if (file_put_contents($testFile, $testContent) !== false) {
        $results[] = ['PASS', 'Successfully wrote to test file.', $testFile];
        
        // Attempt to read the file
        $readContent = file_get_contents($testFile);
        if ($readContent === $testContent) {
            $results[] = ['PASS', 'Successfully read back the correct content from test file.'];
        } else {
            $results[] = ['FAIL', 'Content read from test file did not match what was written.'];
        }
        // Clean up the test file
        unlink($testFile);
    } else {
        $results[] = ['FAIL', 'Failed to write to test file.', $testFile];
    }

    // Display permissions results
    echo "<table>";
    foreach ($results as $result) {
        $status = $result[0];
        $message = $result[1];
        $details = $result[2] ?? '';
        echo "<tr><td class='status status-" . strtolower($status) . "'>$status</td><td>$message</td><td><pre>$details</pre></td></tr>";
    }
    echo "</table>";


    // --- Test 2: API Endpoint Execution ---
    echo "<h2>2. API Endpoint Tests</h2>";

    // IMPORTANT: Close the session for this diagnostic script to prevent deadlocks.
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']) . '/index.php';

    $apiTests = [
        ['action' => 'reset', 'method' => 'GET', 'data' => []],
        ['action' => 'add_player', 'method' => 'POST', 'data' => ['playerName' => 'TestPlayer1']],
        ['action' => 'get_setup_players', 'method' => 'GET', 'data' => []],
        ['action' => 'get_players', 'method' => 'GET', 'data' => []],
    ];

    echo "<table>";
    echo "<tr><th>Action</th><th>Method</th><th>Status Code</th><th>Response Payload</th></tr>";

    $sessionCookie = 'PHPSESSID=' . session_id();

    foreach ($apiTests as $test) {
        $url = $baseUrl;
        $postData = null;

        if ($test['method'] === 'GET') {
            $url .= '?action=' . $test['action'];
        } else {
            $postData = array_merge($test['data'], ['action' => $test['action']]);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_COOKIE, $sessionCookie); // Pass session cookie

        if ($postData) {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }

        $responseBody = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $statusClass = ($statusCode >= 200 && $statusCode < 300 && !empty(trim($responseBody))) ? 'status-pass' : 'status-fail';

        echo "<tr>";
        echo "<td>" . htmlspecialchars($test['action']) . "</td>";
        echo "<td>" . htmlspecialchars($test['method']) . "</td>";
        echo "<td class='$statusClass'>" . htmlspecialchars($statusCode) . "</td>";
        echo "<td><pre>" . htmlspecialchars($responseBody) . "</pre></td>";
        echo "</tr>";
    }
    echo "</table>";
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Application Diagnostics</title>
    <style>
        body { font-family: sans-serif; background-color: #1a1a1a; color: #f0f0f0; padding: 20px; }
        .container { max-width: 1200px; margin: auto; }
        h1, h2 { color: #00d1b2; border-bottom: 1px solid #444; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #444; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #2c2c2c; }
        pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        .status { font-weight: bold; }
        .status-pass { color: #00d1b2; }
        .status-fail { color: #ff3860; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Application Diagnostics</h1>
        <?php run_diagnostics(); ?>
    </div>
</body>
</html>
```

### Instructions

1.  **Create the file:** Add this new `diagnostics.php` file to your `public` directory and upload it to your server.
2.  **Run the test:** Open your web browser and navigate to `https://dartboard.andrewwestley.co.uk/diagnostics.php`.

The page will automatically run the tests and present a clear, color-coded report. This report will definitively show whether your file permissions are correct and what status codes and payloads your API endpoints are *actually* returning.

This will give us the hard data needed to finally solve this problem. My apologies again for the unacceptable amount of time this has taken.

<!--
[PROMPT_SUGGESTION]The diagnostics page shows a file permissions error. How do I fix it in Plesk?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]The diagnostics page shows a PHP error in the API response. Can you fix it?[/PROMPT_SUGGESTION]
-->