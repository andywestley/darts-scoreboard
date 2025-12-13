<?php

use Darts\App;

use Darts\Service\Logger;
// 1. Bootstrap the application
require_once __DIR__ . '/../bootstrap.php';

// Use JWT classes, which are loaded manually in bootstrap.php
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

// 2. Simple Routing
$action = $_SERVER['HTTP_X_ACTION'] ?? $_POST['action'] ?? $_GET['action'] ?? '';

// 3. JWT Validation (replaces CSRF check)
if ($action && $action !== 'auth:getToken') { // Every action except getting a token requires validation
    if (!preg_match('/Bearer\s(\S+)/', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $matches)) {
        http_response_code(401);
        $logger->warning('Authorization token not found in request.', ['action' => $action, 'ip' => $_SERVER['REMOTE_ADDR']]);
        die(json_encode(['success' => false, 'error' => 'Authorization token not found.']));
    }

    $jwt = $matches[1];
    $secretKey = 'your-super-secret-key'; // This should be stored securely

    try {
        JWT::decode($jwt, new Key($secretKey, 'HS256'));
    } catch (Exception $e) {
        $logger->warning('Invalid JWT provided.', ['action' => $action, 'error' => $e->getMessage(), 'ip' => $_SERVER['REMOTE_ADDR']]);
        http_response_code(401);
        die(json_encode(['success' => false, 'error' => 'Invalid token: ' . $e->getMessage()]));
    }
}

// If the request is for an API action, run the API and exit.
if ($action) {
    ob_start(); // Start output buffering
    try {
        $app = new App($logger);
        $app->run($action);
    } catch (Exception $e) {
        // This will be caught by the global exception handler in bootstrap.php
        // but we have it here for clarity. The handler will format it as JSON.
        throw $e;
    }
    $output = ob_get_clean(); // Get the buffer content and clean the buffer

    if (empty($output) && json_last_error() === JSON_ERROR_NONE) {
        // If no output was generated, it's very likely the action was not found in the App's router.
        // We can return a 404 here, as the requested *resource (the action)* was not found.
        http_response_code(404);
        $output = json_encode([
            'success' => false, 
            'error' => "Action '{$action}' not found."
        ]);
    }
    echo $output;
    exit; // Stop execution after handling the API request.
}

// If there's no action, proceed with rendering the HTML view.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pro Darts Scorer (PHP Edition)</title>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <link rel="stylesheet" href="css/style.css?v=<?php echo filemtime('css/style.css'); ?>">
</head>
<body>
    <!-- Setup Screen -->
    <div id="setupScreen" class="screen active">
        <div class="setup-container">
            <h1>🎯 Pro Darts Scorer</h1>
            
            <div class="input-group">
                <label>Game Type</label>
                <select id="gameType">
                    <option value="301">301</option>
                    <option value="501" selected>501</option>
                    <option value="701">701</option>
                </select>
            </div>

            <div class="input-group">
                <label>Match Format (First to)</label>
                <select id="matchLegs">
                    <option value="1" selected>1 Leg</option>
                    <option value="3">3 Legs</option>
                    <option value="5">5 Legs</option>
                </select>
            </div>

            <div class="input-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="checkoutAssistantToggle" checked>
                    <label for="checkoutAssistantToggle">Show Checkout Assistant</label>
                </div>
            </div>

            <div class="input-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="soundEffectsToggle">
                    <label for="soundEffectsToggle">Enable Sound Effects</label>
                </div>
            </div>

            <div class="input-group">
                <label>Add Players</label>
                <div class="player-input-controls">
                    <label for="newPlayerName" class="visually-hidden">Player Name</label>
                    <input type="text" id="newPlayerName" placeholder="Enter name..." autocomplete="off">
                    <button class="btn btn-secondary btn-add-player" id="addPlayerBtn">+</button>
                </div>
            </div>

            <div class="input-group">
                <label>Players in Game</label>
                <div class="player-list" id="playerList"></div>
            </div>

            <button class="btn" id="startGameBtn">Start Game</button>
            <button class="btn btn-secondary" onclick="showScreen('statsScreen')">View Player Stats</button>
            <button class="btn btn-secondary" onclick="showScreen('matchHistoryScreen')">Match History</button>
        </div>
    </div>

    <!-- Game Screen -->
    <div id="gameScreen" class="screen game-container" data-rendered="false">
        <!-- This is now a skeleton. JS will render all content inside. -->
        <header>
            <!-- The "New Game" button is now handled by JavaScript to avoid full page reloads -->
            <button id="resetGameBtn" class="reset-link-button">← New Game</button>
            <!-- "Kill Switch" for forcing a session reset if the main JS fails -->
            <button id="forceResetBtn" class="reset-link-button" style="color: #dc3545; margin-left: auto;">Force Reset</button>
            <span id="legDisplay" class="header-title"></span>
        </header>

        <div class="leaderboard" id="leaderboard"></div>

        <div class="controls keypad-container">
            <div class="darts-thrown-display" id="dartsThrownDisplay"></div>
            <div class="input-display" id="inputDisplay">0</div>
            <div class="checkout-suggestion" id="checkoutHint"></div>
            <div class="dartboard-keypad">
                <div class="modifiers">
                    <button class="key key-mod" id="modDouble">Double</button>
                    <button class="key key-mod" id="modTreble">Treble</button>
                </div>
                <div class="numbers" id="keypadNumbers">
                    <!-- Numbers 1-20 are dynamically generated by screen.game.js -->
                </div>
                <div class="specials" id="keypadSpecials">
                    <div class="specials-row">
                        <button class="key key-bull" data-score="25">OUTER BULL</button>
                        <button class="key key-bull" data-score="50">BULLSEYE</button>
                        <button class="key key-special" data-score="0">MISS</button>
                    </div>
                    <div class="specials-row">
                        <button class="key key-special key-del" id="undoBtn">UNDO</button>
                        <button class="key key-special key-submit" id="submitTurnBtn">SUBMIT</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="burnDownChartContainer" class="chart-container"></div>

        <!-- Win Modal (for leg wins) -->
        <div id="winModal" class="modal">
            <h2 id="winnerText">WINNER!</h2>
            <div class="confetti" id="winnerConfetti">Game Shot!</div>
            <div class="winner-stats" id="winnerStats"></div>
            <button class="btn btn-modal-action" id="nextLegBtn">Start Next Leg</button>
        </div>
    </div>

    <!-- Stats Screen -->
    <div id="statsScreen" class="screen">
        <header>
            <a href="#" onclick="showScreen('setupScreen')" class="reset-link">← Back to Setup</a>
            <span class="header-title">Player Statistics</span>
        </header>
        <div class="stats-container">
            <div class="player-stats-list">
                <h2>Registered Players</h2>
                <ul id="registeredPlayersUl"></ul>
            </div>
            <div id="playerStatsDetails">
                <h2>Select a Player</h2>
                <p>Click on a player from the list to see their detailed stats.</p>
                <div id="avgChartContainer"></div>
                <div id="h2hStatsContainer"></div>
            </div>
        </div>
    </div>

    <!-- Match History Screen -->
    <div id="matchHistoryScreen" class="screen">
        <header>
            <a href="#" onclick="showScreen('setupScreen')" class="reset-link">← Back to Setup</a>
            <span class="header-title">Match History</span>
        </header>
        <div class="match-history-container" id="matchHistoryContainer">
            <p>Loading match history...</p>
        </div>
    </div>

    <!-- Match Summary Screen -->
    <div id="matchSummaryScreen" class="screen">
        <!-- This is now a skeleton. JS will render the summary. -->
        <div class="match-summary-container">
            <h2>Match Over!</h2>
            <h3 id="matchWinnerName"></h3>
            <div id="matchSummaryTableContainer"></div>
            <!-- This button will also be handled by JavaScript -->
            <button id="startNewMatchBtn" class="btn btn-match-action">Start New Match</button>
        </div>
    </div>

    <!-- Audio Elements -->
    <audio id="dartHitSound" src="sounds/click.mp3" preload="none"></audio>
    <audio id="bustSound" src="sounds/bust.mp3" preload="none"></audio>
    <audio id="oneEightySound" src="sounds/180.mp3" preload="none"></audio>
    <audio id="winSound" src="sounds/win.mp3" preload="none"></audio>

<!-- This script is separate from app.js to ensure the "Force Reset" button always works, even if app.js crashes. -->
<script>
    document.addEventListener('DOMContentLoaded', function() {
        const forceResetBtn = document.getElementById('forceResetBtn');
        if (forceResetBtn) {
            forceResetBtn.addEventListener('click', async function() {
                if (confirm('This will force a full reset of the game session. Are you sure?')) {
                    try {
                        // We need a JWT to perform any action.
                        let token = localStorage.getItem('darts_jwt');
                        if (!token) {
                            alert('No authentication token found. Cannot reset.');
                            return;
                        }

                        const response = await fetch('index.php', {
                            method: 'POST',
                            headers: {
                                'X-Action': 'session:reset',
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        // Check if the HTTP request itself was successful.
                        if (response.ok) {
                            // If the server responded with a 2xx status, it's safe to reload.
                            window.location.reload();
                        } else {
                            alert(`Reset failed. The server responded with status: ${response.status}. Check the console for more details.`);
                        }
                    } catch (e) {
                        alert('An error occurred while trying to force a reset. Check the console.');
                        console.error('Force Reset Failed:', e);
                    }
                }
            });
        }
    });
</script>
<script src="js/screen.setup.js?v=<?= filemtime('js/screen.setup.js') ?>" defer></script>
<script src="js/screen.game.js?v=<?= filemtime('js/screen.game.js') ?>" defer></script>
<script src="js/screen.stats.js?v=<?= filemtime('js/screen.stats.js') ?>" defer></script>
<script src="js/app.js?v=<?= filemtime('js/app.js') ?>" defer></script>

</body>
</html>