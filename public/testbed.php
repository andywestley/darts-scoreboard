<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

// Bootstrap the main application to gain access to services and the logger.
require_once __DIR__ . '/../bootstrap.php';

// Use the service classes we want to test directly.
use Darts\Service\GameService;

function run_diagnostics() {
    global $logger; // Access the logger initialized in bootstrap.php

    $report = [
        'environment'   => [],
        'permissions'   => [],
        'service_tests' => [],
        'api'           => [],
        'logging'       => [],
    ];

    // --- Test 0: PHP Environment ---
    $envResults = [];
    $requiredPhpVersion = '7.4'; // A sensible modern requirement.
    $currentPhpVersion = PHP_VERSION;

    if (version_compare($currentPhpVersion, $requiredPhpVersion, '>=')) {
        $envResults[] = ['PASS', "PHP version is {$currentPhpVersion}, which meets the requirement (>= {$requiredPhpVersion})."];
    } else {
        $envResults[] = ['FAIL', "PHP version is {$currentPhpVersion}, which is below the minimum requirement of {$requiredPhpVersion}."];
    }

    $requiredExtensions = ['json', 'session', 'curl'];
    foreach ($requiredExtensions as $ext) {
        if (extension_loaded($ext)) {
            $envResults[] = ['PASS', "Required extension '{$ext}' is loaded."];
        } else {
            $envResults[] = ['FAIL', "Required extension '{$ext}' is NOT loaded."];
        }
    }
    $report['environment'] = $envResults;

    // --- Test 1: File System Permissions ---
    $dataDir = __DIR__ . '/../data';
    $testFile = $dataDir . '/permission_test.tmp';
    $testContent = 'write_test_' . time();
    $permResults = [];

    $permResults[] = is_dir($dataDir) ? ['PASS', 'Data directory exists.', $dataDir] : ['FAIL', 'Data directory does not exist.', $dataDir];
    $permResults[] = is_writable($dataDir) ? ['PASS', 'Data directory is writable.'] : ['FAIL', 'Data directory is NOT writable.'];

    if (@file_put_contents($testFile, $testContent) !== false) {
        $permResults[] = ['PASS', 'Successfully wrote to test file.', $testFile];
        $readContent = @file_get_contents($testFile);
        $permResults[] = ($readContent === $testContent) ? ['PASS', 'Successfully read back content.'] : ['FAIL', 'Content read did not match.'];
        @unlink($testFile);
    } else {
        $permResults[] = ['FAIL', 'Failed to write to test file.', $testFile];
    }
    $report['permissions'] = $permResults;

    // --- NEW: Backend Service Tests (from c:\testbed.php) ---
    $serviceResults = [];

    // Test 1: Logger Functionality
    $logFile = ROOT_PATH . '/logs/app_log.txt';
    if (file_exists($logFile)) {
        unlink($logFile); // Clear log for a clean test run
    }
    $logger->info("This is an info message from the service test.");
    $logger->error("This is an error message from the service test.", ['test_case' => 'Logger']);
    $logContents = file_get_contents($logFile);

    if (str_contains($logContents, '] [INFO] This is an info message') && str_contains($logContents, '] [ERROR] This is an error message')) {
        $serviceResults[] = ['PASS', 'Logger Service Test: Messages were written and verified successfully.'];
    } else {
        $serviceResults[] = ['FAIL', 'Logger Service Test: Verification failed. Messages not found in log file.'];
    }

    // Test 2: GameService Bust Logic
    $gameService = new GameService($logger);
    $bustTestMatch = [
        'currentPlayerIndex' => 0,
        'players' => [['name' => 'Player 1', 'score' => 50, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => [501, 50]]],
        'history' => [],
        'gameType' => 501,
        'matchLegs' => 3,
        'currentLeg' => 1,
    ];
    // A single dart of 60 on a score of 50 is a bust.
    $updatedMatch = $gameService->applyScore($bustTestMatch, [60]);

    // A bust means the score should NOT change.
    if (isset($updatedMatch['players'][0]['score']) && $updatedMatch['players'][0]['score'] === 50) {
        $serviceResults[] = ['PASS', 'GameService Bust Logic Test: Player score correctly remained unchanged after a bust.'];
    } else {
        $finalScore = $updatedMatch['players'][0]['score'] ?? 'N/A';
        $serviceResults[] = ['FAIL', "GameService Bust Logic Test: Player score changed to {$finalScore} after a bust, but should have remained 50."];
    }

    // Test 3: GameService Turn-Based Scoring
    $turnTestMatch = [
        'currentPlayerIndex' => 0,
        'players' => [['name' => 'Player 1', 'score' => 501, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => [501]]],
        'history' => [],
        'gameType' => 501,
        'matchLegs' => 3,
        'currentLeg' => 1,
    ];
    // Simulate a turn of T20, 20, 5 (total 85)
    $updatedTurnMatch = $gameService->applyScore($turnTestMatch, [60, 20, 5]);
    $expectedScore = 501 - 85; // 416

    if (isset($updatedTurnMatch['players'][0]['score']) && $updatedTurnMatch['players'][0]['score'] === $expectedScore) {
        $serviceResults[] = ['PASS', 'GameService Turn-Based Scoring Test: Player score correctly updated after a valid turn (501 - 85 = 416).'];
    } else {
        $finalScore = $updatedTurnMatch['players'][0]['score'] ?? 'N/A';
        $serviceResults[] = ['FAIL', "GameService Turn-Based Scoring Test: Player score was {$finalScore}, but should have been {$expectedScore}."];
    }

    // Test 4: GameService Valid Checkout Logic
    $validCheckoutMatch = [
        'currentPlayerIndex' => 0,
        'players' => [['name' => 'Player 1', 'score' => 40, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => [501, 40]]],
        'history' => [], 'gameType' => 501, 'matchLegs' => 3, 'currentLeg' => 1,
    ];
    // Simulate a checkout on Double 20
    $checkoutDarts = [['score' => 40, 'multiplier' => 2, 'base' => 20]];
    $updatedCheckoutMatch = $gameService->applyScore($validCheckoutMatch, $checkoutDarts);

    if (isset($updatedCheckoutMatch['players'][0]['legsWon']) && $updatedCheckoutMatch['players'][0]['legsWon'] === 1) {
        $serviceResults[] = ['PASS', 'GameService Valid Checkout Test: Player correctly won the leg on a double-out.'];
    } else {
        $legsWon = $updatedCheckoutMatch['players'][0]['legsWon'] ?? 'N/A';
        $serviceResults[] = ['FAIL', "GameService Valid Checkout Test: Player should have won the leg, but legs won is {$legsWon}."];
    }

    // Test 5: GameService Invalid Checkout Logic (should bust)
    $invalidCheckoutMatch = [
        'currentPlayerIndex' => 0,
        'players' => [['name' => 'Player 1', 'score' => 30, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => [501, 30]]],
        'history' => [], 'gameType' => 501, 'matchLegs' => 3, 'currentLeg' => 1,
    ];
    // Simulate an invalid checkout on Single 10 after hitting a 20
    $invalidDarts = [
        ['score' => 20, 'multiplier' => 1, 'base' => 20],
        ['score' => 10, 'multiplier' => 1, 'base' => 10]
    ];
    $updatedInvalidMatch = $gameService->applyScore($invalidCheckoutMatch, $invalidDarts);

    if (isset($updatedInvalidMatch['players'][0]['score']) && $updatedInvalidMatch['players'][0]['score'] === 30) {
        $serviceResults[] = ['PASS', 'GameService Invalid Checkout Test: Player score correctly reverted to 30 after an invalid (non-double) out.'];
    } else {
        $finalScore = $updatedInvalidMatch['players'][0]['score'] ?? 'N/A';
        $serviceResults[] = ['FAIL', "GameService Invalid Checkout Test: Player score was {$finalScore}, but should have reverted to 30."];
    }

    $report['service_tests'] = $serviceResults;


    // --- Test 2: API Endpoint Execution ---
    // With a stateless JWT architecture, we first need to fetch a token.
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']) . '/index.php';

    $jwtToken = null;
    $authCh = curl_init($baseUrl);
    curl_setopt($authCh, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($authCh, CURLOPT_HTTPHEADER, ['X-Action: auth:getToken']);
    curl_setopt($authCh, CURLOPT_POST, 1);
    $authResponse = curl_exec($authCh);
    $authStatusCode = curl_getinfo($authCh, CURLINFO_HTTP_CODE);
    $authCurlErrorNum = curl_errno($authCh);
    $authCurlErrorMsg = curl_error($authCh);
    curl_close($authCh);

    $authData = json_decode($authResponse, true);
    if (isset($authData['success']) && $authData['success'] && isset($authData['token'])) {
        $jwtToken = $authData['token'];
    } else {
        // If we can't get a token, we can't run the tests. Return a structured error.
        $report['api'] = [[
            'test' => ['action' => 'auth:getToken', 'method' => 'POST'],
            'status_code' => $authStatusCode ?: 500,
            'response_body' => 'Failed to retrieve a valid JWT to run tests. Response: ' . $authResponse,
            'request_url' => $baseUrl,
            'post_data_sent' => [],
            'response_headers' => '', // Ensure this property exists
            'curl_error_num' => curl_errno($authCh),
            'curl_error_msg' => curl_error($authCh),
        ]];
        return $report;
    }

    $playersDataFile = __DIR__ . '/../data/players.json';

    // Updated API tests for the stateless architecture
    $apiTests = [
        ['action' => 'player:persist', 'method' => 'POST', 'data' => ['playerName' => 'Test Player A']],
        ['action' => 'player:persist', 'method' => 'POST', 'data' => ['playerName' => 'Test Player B']],
        [
            'action' => 'game:start', 
            'method' => 'POST', 
            'data' => [
                'players' => json_encode(['Test Player A', 'Test Player B']), 
                'gameType' => '301'
            ]
        ],
        // The game:score test now requires the full match state, which is handled dynamically below.
    ];

    $apiResults = [];

    // This will hold the latest game state as we move through the tests.
    $currentMatchState = null;

    foreach ($apiTests as $test) {
        $testResult = ['test' => $test];
        $testResult['players_before'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
        $url = $baseUrl;
        // Move action to a header to avoid mod_security filters.
        $actionHeader = 'X-Action: ' . $test['action'];
        $authHeader = 'Authorization: Bearer ' . $jwtToken;

        // POST data no longer needs a CSRF token.
        $postData = $test['data'];

        // If we have a match state, add it to the request.
        if ($currentMatchState !== null) {
            $postData['matchState'] = json_encode($currentMatchState);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HEADER, 1); // We want to capture response headers for debugging
        curl_setopt($ch, CURLOPT_HTTPHEADER, [$actionHeader, $authHeader]);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        $testResult['test'] = $test; // Re-assign the modified test array to the result

        $rawResponse = curl_exec($ch);
        // CRITICAL: Get cURL info BEFORE closing the handle to prevent fatal errors.
        $testResult['status_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $testResult['curl_error_num'] = curl_errno($ch);
        $testResult['curl_error_msg'] = curl_error($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch); // Close the handle now that we have the info.

        $responseHeaders = substr($rawResponse, 0, $headerSize);
        $rawBody = substr($rawResponse, $headerSize);
        // Sanitize the response body to ensure it's valid UTF-8, preventing json_encode errors.
        $responseBody = mb_convert_encoding($rawBody, 'UTF-8', 'UTF-8');

        $testResult['request_url'] = $url;
        $testResult['post_data_sent'] = $postData;
        $testResult['response_headers'] = $responseHeaders;
        $testResult['response_body'] = $responseBody;

        // IMPORTANT: Update the current match state for the next iteration.
        $responseJson = json_decode($responseBody, true);
        if (isset($responseJson['success']) && $responseJson['success'] && isset($responseJson['match'])) {
            $currentMatchState = $responseJson['match'];
        }

        $testResult['players_after'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
        $apiResults[] = $testResult;
    }

    // Dynamically add a 'game:score' test if the 'game:start' was successful
    if ($currentMatchState) {
        $scoreTest = [
            'action' => 'game:score',
            'method' => 'POST',
            'data' => [
                'darts' => json_encode([60, 20, 5]), // Simulate a turn of T20, 20, 5 (total 85)
                'matchState' => json_encode($currentMatchState) // Pass the state from the previous 'game:start' call
            ]
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $baseUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HEADER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Action: ' . $scoreTest['action'], 'Authorization: Bearer ' . $jwtToken]);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($scoreTest['data']));

        $rawResponse = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        
        $apiResults[] = [
            'test' => $scoreTest,
            'status_code' => $statusCode,
            'players_before' => 'See previous test step.', // Data is chained
            'players_after' => 'N/A for score test.',
            'response_body' => mb_convert_encoding(substr($rawResponse, $headerSize), 'UTF-8', 'UTF-8'),
            'post_data_sent' => $scoreTest['data'],
            'response_headers' => mb_convert_encoding(substr($rawResponse, 0, $headerSize), 'UTF-8', 'UTF-8'),
        ];
    }

    $report['api'] = $apiResults;

    // --- Test 3: PHP Error Logging ---
    $logFile = '/var/www/vhosts/andrewwestley.co.uk/dartboard.andrewwestley.co.uk/logs/php_errors.log';
    $logResults = [];
    $logDir = dirname($logFile);

    if (is_dir($logDir)) {
        $logResults[] = ['PASS', "Log directory exists.", $logDir];
        if (is_writable($logDir)) {
            $logResults[] = ['PASS', "Log directory is writable."];

            // Check file writability or creatability
            if (file_exists($logFile)) {
                if (is_writable($logFile)) {
                    $logResults[] = ['PASS', "Log file exists and is writable.", $logFile];
                } else {
                    $logResults[] = ['FAIL', "Log file exists but is NOT writable. Check permissions.", $logFile];
                }
            } else {
                $logResults[] = ['PASS', "Log file does not exist, but directory is writable (should be auto-created).", $logFile];
            }

            // Attempt to write and verify
            $uniqueMarker = "LOG_TEST_" . bin2hex(random_bytes(8));
            $testMessage = "PHP log test from testbed.php successful. Marker: " . $uniqueMarker;
            error_log($testMessage);
            $logResults[] = ['INFO', "Attempted to write test message with marker: {$uniqueMarker}"];

            // Give the filesystem a moment
            sleep(1);
            if (file_exists($logFile) && ($logContents = file_get_contents($logFile)) !== false) {
                if (strpos($logContents, $uniqueMarker) !== false) {
                    $logResults[] = ['PASS', "Verification complete. Test message found in log file."];
                } else {
                    $logResults[] = ['FAIL', "Verification failed. Test message NOT found. Check PHP's `error_log` directive."];
                }
            } else {
                 $logResults[] = ['FAIL', "Could not read the log file after attempting to write to it."];
            }
        } else {
            $logResults[] = ['FAIL', "Log directory is NOT writable. Check permissions.", $logDir];
        }
    } else {
        $logResults[] = ['FAIL', "Log directory does not exist.", $logDir];
    }
    $report['logging'] = $logResults;

    return $report;
}

$reportData = run_diagnostics();

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Testbed &amp; Diagnostics</title>
    <link rel="stylesheet" href="css/style.css?v=<?php echo time(); ?>">
    <link rel="stylesheet" href="css/testbed.css?v=<?php echo time(); ?>">
</head>
<body class="testbed-page">
    <div class="container">
        <h1>🎯 Darts Scoreboard - Debugging Tools</h1>

        <!-- Diagnostics Report Content -->
        <div id="diagnosticsTab" class="tab-content active" style="display: block;">
            <div id="report-container">
                <button id="copyBtn">Copy Full Report to Clipboard</button>
                <h2>0. PHP Environment</h2>
                <table>
                    <?php foreach ($reportData['environment'] as $result): ?>
                        <tr>
                            <td class="status status-<?php echo strtolower($result[0]); ?>"><?php echo $result[0]; ?></td>
                            <td><?php echo htmlspecialchars($result[1]); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </table>

                <h2>1. File System Permissions Test</h2>
                <table>
                    <?php foreach ($reportData['permissions'] as $result): ?>
                        <tr>
                            <td class="status status-<?php echo strtolower($result[0]); ?>"><?php echo $result[0]; ?></td>
                            <td><?php echo htmlspecialchars($result[1]); ?></td>
                            <td><pre><?php echo htmlspecialchars($result[2] ?? ''); ?></pre></td>
                        </tr>
                    <?php endforeach; ?>
                </table>

                <h2>2. Backend Service Tests</h2>
                <table>
                    <?php foreach ($reportData['service_tests'] as $result): ?>
                        <tr>
                            <td class="status status-<?php echo strtolower($result[0]); ?>"><?php echo $result[0]; ?></td>
                            <td><?php echo htmlspecialchars($result[1]); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </table>

                <h2>3. PHP Error Logging</h2>
                <table>
                    <?php foreach ($reportData['logging'] as $result): ?>
                        <tr>
                            <td class="status status-<?php echo strtolower($result[0]); ?>"><?php echo $result[0]; ?></td>
                            <td><?php echo htmlspecialchars($result[1]); ?></td>
                            <td><pre><?php echo htmlspecialchars($result[2] ?? ''); ?></pre></td>
                        </tr>
                    <?php endforeach; ?>
                </table>

                <h2>4. API Endpoint Tests</h2>
                <table>
                    <tr><th>Action</th><th>Method</th><th>Status Code</th><th>Details</th></tr>
                    <?php foreach ($reportData['api'] as $result): ?>
                        <?php
                            $test = $result['test'];
                            $statusCode = $result['status_code'] ?? 'N/A';
                            $isPass = ($statusCode >= 200 && $statusCode < 300);
                            $statusClass = $isPass ? 'status-pass' : 'status-fail';

                            // Helper to pretty-print JSON strings
                            $prettyPrintJson = function($jsonString) {
                                $data = json_decode($jsonString);
                                if (json_last_error() === JSON_ERROR_NONE) {
                                    return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
                                }
                                return $jsonString; // Return original if not valid JSON
                            };
                        ?>
                        <tr>
                            <td><?php echo htmlspecialchars($test['action'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($test['method'] ?? 'N/A'); ?></td>
                            <td class="<?php echo $statusClass; ?>"><?php echo htmlspecialchars($statusCode); ?></td>
                            <td>
                                <div class="api-detail-block">
                                    <strong>players.json (before)</strong>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['players_before'] ?? '')); ?></pre>
                                </div>
                                <div class="api-detail-block">
                                    <strong>players.json (after)</strong>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['players_after'] ?? '')); ?></pre>
                                </div>
                                <div class="api-detail-block">
                                    <strong>API Response Payload</strong>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['response_body'])); ?></pre>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </table>
            </div>
        </div>
    </div>

    <!-- Embed the full report data as JSON for the copy-to-clipboard functionality -->
    <script id="report-data-json" type="application/json">
        <?php
            // Defensive JSON encoding. If this fails, output a valid JSON object with an error message.
            $jsonReport = json_encode($reportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
            if (json_last_error() !== JSON_ERROR_NONE) {
                echo json_encode(['error' => 'Failed to encode report data.', 'json_error_message' => json_last_error_msg()]);
            } else {
                echo $jsonReport;
            }
        ?>
    </script>

    <script src="js/testbed.js" defer></script>
</body>
</html>
