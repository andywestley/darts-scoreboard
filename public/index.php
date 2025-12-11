<?php

use Darts\App;

// 1. Bootstrap the application
require_once __DIR__ . '/../bootstrap.php';

// 2. Simple Routing
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Validate CSRF token for all POST actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
    if (!isset($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
        // CSRF token mismatch, handle the error appropriately.
        // For simplicity, we can just exit or show an error.
        http_response_code(403); // Forbidden
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'CSRF token validation failed.'
        ]);
        exit;
    }
}

// If the request is for an API action, run the API and exit.
if ($action) {
    ob_start(); // Start output buffering
    try {
        $app = new App();
        $app->run();
    } catch (Exception $e) {
        // This will be caught by the global exception handler in bootstrap.php
        // but we have it here for clarity. The handler will format it as JSON.
        throw $e;
    }
    $output = ob_get_clean(); // Get the buffer content and clean the buffer

    if (empty($output) && json_last_error() === JSON_ERROR_NONE) {
        $output = json_encode(['success' => false, 'error' => "API action '{$action}' did not return any output."]);
    }
    echo $output;
    exit; // Stop execution after handling the API request.
}

// If there's no action, proceed with rendering the HTML view.
// --- VIEW RENDERING LOGIC ---

// Determine which screen to display based on the session state.
// Defaults to 'setup', but will show 'summary' if the match is over.
$current_screen = $_SESSION['screen'] ?? 'setup';
if (isset($_SESSION['match']) && $_SESSION['match']['isOver']) {
    $current_screen = 'summary';
}

// Inject initial state into a JavaScript variable for the client-side app.
// This avoids an extra AJAX call on page load and is more efficient.
$initial_state_json = 'null';
if ($current_screen === 'game' || $current_screen === 'summary') {
    $initial_state_json = json_encode($_SESSION['match'] ?? null);
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo $_SESSION['csrf_token']; ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pro Darts Scorer (PHP Edition)</title>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script> 
    <link rel="stylesheet" href="css/style.css?v=<?php echo filemtime('css/style.css'); ?>">
</head>
<body>
    <!-- A hidden script tag to pass the initial PHP state to our JavaScript file -->
    <script id="initial-state-data" type="application/json"><?php echo htmlspecialchars($initial_state_json, ENT_QUOTES | ENT_SUBSTITUTE); ?></script>
    <!-- Setup Screen -->
    <div id="setupScreen" class="screen <?php if ($current_screen === 'setup') echo 'active'; ?>">
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
                    <input type="checkbox" id="soundEffectsToggle" checked>
                    <label for="soundEffectsToggle">Enable Sound Effects</label>
                </div>
            </div>

            <div class="input-group">
                <label>Add Players</label>
                <div class="player-input-controls">
                    <input type="text" id="newPlayerName" placeholder="Enter name...">
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
    <div id="gameScreen" class="screen <?php if ($current_screen === 'game') echo 'active'; ?>" data-rendered="false">
        <!-- This is now a skeleton. JS will render all content inside. -->
        <header>
            <form action="index.php" method="post" style="display: inline;">
                <input type="hidden" name="action" value="reset">
                <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                <button type="submit" class="reset-link-button">← New Game</button>
            </form>
            <span id="legDisplay"></span>
        </header>

        <div class="active-player-display">
            <div class="player-name-large" id="activeName"></div>
            <div class="current-score-large" id="activeScore"></div>
            <div class="stats-badge" id="activeAvg"></div>
            <div class="checkout-suggestion" id="checkoutHint"></div>
        </div>

        <div id="burnDownChartContainer"></div>

        <div class="leaderboard" id="leaderboard"></div>

        <div class="controls">
            <div class="darts-thrown-display" id="dartsThrownDisplay"></div>
            <div class="input-display" id="inputDisplay">0</div>
            <div class="dartboard-keypad">
                <div class="modifiers">
                    <button class="key key-mod" id="modDouble">D</button>
                    <button class="key key-mod" id="modTreble">T</button>
                    <button class="key key-special" data-score="0">MISS</button>
                    <button class="key key-special key-del" id="undoBtn">UNDO</button>
                </div>
                <div class="numbers" id="keypadNumbers"></div>
                <div class="specials" id="keypadSpecials">
                    <button class="key key-bull" data-score="25">OUTER BULL</button>
                    <button class="key key-bull" data-score="50">BULLSEYE</button>
                </div>
            </div>
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
    <div id="matchSummaryScreen" class="screen <?php if ($current_screen === 'summary') echo 'active'; ?>">
        <!-- This is now a skeleton. JS will render the summary. -->
        <div class="match-summary-container">
            <h2>Match Over!</h2>
            <h3 id="matchWinnerName"></h3>
            <div id="matchSummaryTableContainer"></div>
            <form action="index.php" method="post">
                <input type="hidden" name="action" value="reset">
                <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                <button type="submit" class="btn btn-match-action">Start New Match</button>
            </form>
        </div>
    </div>

    <!-- Win Modal (for leg wins) -->
    <div id="winModal" class="modal">
        <h2 id="winnerText">WINNER!</h2>
        <div class="confetti" id="winnerConfetti">Game Shot!</div>
        <div class="winner-stats" id="winnerStats"></div>
        <button class="btn btn-modal-action" id="nextLegBtn">Start Next Leg</button>
    </div>

    <!-- Audio Elements -->
    <audio id="dartHitSound" src="sounds/click.mp3" preload="auto"></audio>
    <audio id="bustSound" src="sounds/bust.mp3" preload="auto"></audio>
    <audio id="oneEightySound" src="sounds/180.mp3" preload="auto"></audio>
    <audio id="winSound" src="sounds/win.mp3" preload="auto"></audio>

<script src="js/app.js" defer></script>

</body>
</html>