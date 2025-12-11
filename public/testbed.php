<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

function run_diagnostics() {
    $report = [];

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
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']) . '/index.php';
    $errorLogPath = '/var/www/vhosts/andrewwestley.co.uk/logs/error_log';
    $playersDataFile = __DIR__ . '/../data/players.json';

    $apiTests = [
        ['action' => 'reset', 'method' => 'GET', 'data' => []],
        ['action' => 'add_player', 'method' => 'POST', 'data' => ['playerName' => 'TestPlayer1']],
        ['action' => 'get_setup_players', 'method' => 'GET', 'data' => []],
        ['action' => 'get_players', 'method' => 'GET', 'data' => []],
    ];

    $apiResults = [];
    $sessionCookie = 'PHPSESSID=' . session_id();

    foreach ($apiTests as $test) {
        $testResult = ['test' => $test];
        $testResult['players_before'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
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
        curl_setopt($ch, CURLOPT_COOKIE, $sessionCookie);
        if ($postData) {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }
        $testResult['response_body'] = curl_exec($ch);
        $testResult['status_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $testResult['players_after'] = file_exists($playersDataFile) ? file_get_contents($playersDataFile) : 'File not found.';
        $testResult['error_log_snippet'] = file_exists($errorLogPath) ? shell_exec('tail -n 20 ' . escapeshellarg($errorLogPath)) : 'Error log not found or accessible.';
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
</head>
<body class="testbed-page">
    <div class="container">
        <h1>🎯 Darts Scoreboard - Debugging Tools</h1>

        <div class="tabs">
            <button class="tab-link active" data-tab="interactiveTab">Interactive Testbed</button>
            <button class="tab-link" data-tab="diagnosticsTab">Diagnostics Report</button>
        </div>

        <!-- Interactive Testbed Content -->
        <div id="interactiveTab" class="tab-content active">
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
        <div id="diagnosticsTab" class="tab-content">
            <div id="report-container">
                <button id="copyBtn">Copy Full Report to Clipboard</button>
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
                            $responseBody = $result['response_body'];
                            $isPass = ($statusCode >= 200 && $statusCode < 300 && !empty(trim($responseBody)));
                            $statusClass = $isPass ? 'status-pass' : 'status-fail';
                        ?>
                        <tr>
                            <td><?php echo htmlspecialchars($test['action']); ?></td>
                            <td><?php echo htmlspecialchars($test['method']); ?></td>
                            <td class="<?php echo $statusClass; ?>"><?php echo htmlspecialchars($statusCode); ?></td>
                            <td>
                                <details>
                                    <summary>players.json (before)</summary>
                                    <pre><?php echo htmlspecialchars($result['players_before']); ?></pre>
                                </details>
                                <details>
                                    <summary>players.json (after)</summary>
                                    <pre><?php echo htmlspecialchars($result['players_after']); ?></pre>
                                </details>
                                <details>
                                    <summary>Raw API Response Payload</summary>
                                    <pre><?php echo htmlspecialchars($responseBody); ?></pre>
                                </details>
                                <details>
                                    <summary>Server Error Log Snippet (last 20 lines)</summary>
                                    <pre><?php echo htmlspecialchars($result['error_log_snippet']); ?></pre>
                                </details>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </table>
            </div>
        </div>
    </div>

    <script src="js/testbed.js" defer></script>
</body>
</html>
