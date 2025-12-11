<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

function run_diagnostics() {
    $report = [];

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

    // --- Test 2: API Endpoint Execution ---
    // We need the CSRF token for POST requests.
    // We must start the session to get it, then close it before making cURL requests.
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $csrfToken = $_SESSION['csrf_token'] ?? null;

    // Close the session to prevent cURL requests from hanging.
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']) . '/index.php';
    $playersDataFile = __DIR__ . '/../data/players.json';

    $apiTests = [
        ['action' => 'session:reset', 'method' => 'POST', 'data' => []],
        ['action' => 'player:add', 'method' => 'POST', 'data' => ['playerName' => 'Player A']],
        ['action' => 'player:add', 'method' => 'POST', 'data' => ['playerName' => 'Player B']],
        ['action' => 'game:start', 'method' => 'POST', 'data' => ['gameType' => '501', 'matchLegs' => '3']],
        // Simulate a round of play
        ['action' => 'game:score', 'method' => 'POST', 'data' => ['score' => 100, 'dartsThrown' => 3]], // Player A's turn
        ['action' => 'game:score', 'method' => 'POST', 'data' => ['score' => 60, 'dartsThrown' => 3]],  // Player B's turn
        // Simulate a bust score for Player A
        ['action' => 'game:score', 'method' => 'POST', 'data' => ['score' => 180, 'dartsThrown' => 3]], // Player A's turn (Score: 401 -> 221)
        ['action' => 'game:score', 'method' => 'POST', 'data' => ['score' => 180, 'dartsThrown' => 3]], // Player B's turn (Score: 441 -> 261)
        ['action' => 'game:score', 'method' => 'POST', 'data' => ['score' => 180, 'dartsThrown' => 3]], // Player A attempts 180 on 221 -> BUST!
        // This final test verifies the game state was updated correctly after the bust.
        ['action' => 'game:state', 'method' => 'POST', 'data' => []],
    ];

    $apiResults = [];
    $sessionCookie = 'PHPSESSID=' . session_id();

    foreach ($apiTests as $test) {
        $testResult = ['test' => $test];
        $testResult['players_before'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
        $url = $baseUrl;
        // Move action to a header to avoid mod_security filters.
        $actionHeader = 'X-Action: ' . $test['action'];
        $postData = array_merge($test['data'], ['csrf_token' => $csrfToken]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HEADER, 1); // We want to capture response headers
        curl_setopt($ch, CURLOPT_COOKIE, $sessionCookie);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [$actionHeader]);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        $test['method'] = 'POST'; // Reflect the actual method used
        $testResult['test'] = $test; // Re-assign the modified test array to the result

        $rawResponse = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

        $testResult['request_url'] = $url;
        $testResult['post_data_sent'] = $postData;
        $testResult['response_headers'] = substr($rawResponse, 0, $headerSize);
        $testResult['response_body'] = substr($rawResponse, $headerSize);
        $testResult['status_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $testResult['curl_error_num'] = curl_errno($ch);
        $testResult['curl_error_msg'] = curl_error($ch);

        curl_close($ch);
        $testResult['players_after'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
        $apiResults[] = $testResult;
    }
    $report['api'] = $apiResults;

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

        <div class="tabs">
            <button class="tab-link" data-tab="interactiveTab">Interactive Testbed</button>
            <button class="tab-link active" data-tab="diagnosticsTab">Diagnostics Report</button>
        </div>

        <!-- Interactive Testbed Content -->
        <div id="interactiveTab" class="tab-content">
            <div class="scrollable-content">
                <p>Use this page to test API actions independently. The raw server response will appear in the pinned window below.</p>
                <fieldset>
                    <legend>Setup Actions</legend>
                    <form>
                        <button type="submit" name="action" value="get_setup_players">Get Setup Players</button>
                    </form>
                    <form>
                        <input type="text" name="playerName" placeholder="Player Name" value="Alice" required>
                        <button type="submit" name="action" value="add_player">Add Player</button>
                    </form>
                    <form>
                        <button type="submit" name="action" value="start_game">Start Game</button>
                        <span class="note">(Adds 'Player 1' & 'Player 2' then starts a 501/3 game)</span>
                    </form>
                </fieldset>
                <fieldset>
                    <legend>Game Actions</legend>
                    <p class="note">A game must be started for these to work.</p>
                    <div class="form-group">
                        <form>
                            <div class="form-row">
                                <input type="number" name="score" placeholder="Score" value="100" required>
                                <input type="number" name="dartsThrown" placeholder="Darts" value="3" style="width: 60px;">
                            </div>
                            <div class="form-row">
                                <label class="checkbox-label"><input type="checkbox" name="isBust" value="true"> Is Bust</label>
                                <label class="checkbox-label"><input type="checkbox" name="isCheckout" value="true"> Is Checkout</label>
                            </div>
                            <button type="submit" name="action" value="submit_score">Submit Score</button>
                        </form>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>Session Management</legend>
                    <form>
                        <button type="submit" name="action" value="reset">Reset Session</button>
                    </form>
                </fieldset>
            </div>
        </div>

        <!-- Diagnostics Report Content -->
        <div id="diagnosticsTab" class="tab-content active">
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
                <h2>2. API Endpoint Tests</h2>
                <table>
                    <tr><th>Action</th><th>Method</th><th>Status Code</th><th>Details</th></tr>
                    <?php foreach ($reportData['api'] as $result): ?>
                        <?php
                            $test = $result['test'];
                            $statusCode = $result['status_code'];
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
                            <td><?php echo htmlspecialchars($test['action']); ?></td>
                            <td><?php echo htmlspecialchars($test['method']); ?></td>
                            <td class="<?php echo $statusClass; ?>"><?php echo htmlspecialchars($statusCode); ?></td>
                            <td>
                                <details>
                                    <summary>players.json (before)</summary>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['players_before'])); ?></pre>
                                </details>
                                <details>
                                    <summary>players.json (after)</summary>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['players_after'])); ?></pre>
                                </details>
                                <details>
                                    <summary>API Response Payload</summary>
                                    <pre><?php echo htmlspecialchars($prettyPrintJson($result['response_body'])); ?></pre>
                                </details>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </table>
            </div>
        </div>
    </div>

    <!-- Embed the full report data as JSON for the copy-to-clipboard functionality -->
    <script id="report-data-json" type="application/json">
        <?php echo json_encode($reportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES); ?>
    </script>

    <!-- Pinned Footer for Interactive Testbed -->
    <div class="response-container">
        <div class="response-pane">
            <div class="title-bar">
                <h2>Log</h2>
                <button id="clearLogBtn">Clear</button>
            </div>
            <textarea id="logTextArea" readonly></textarea>
        </div>
        <div class="response-pane">
            <div class="title-bar">
                <h2>API Response</h2>
                <button id="clearResponseBtn">Clear</button>
            </div>
            <textarea id="responseTextArea" readonly></textarea>
        </div>
    </div>

    <script src="js/testbed.js" defer></script>
</body>
</html>
