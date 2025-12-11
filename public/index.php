<?php
// Start or resume a session to store game state between requests.
session_start();

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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pro Darts Scorer (PHP Edition)</title>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script> 
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- A hidden script tag to pass the initial PHP state to our JavaScript file -->
    <script id="initial-state-data" type="application/json"><?php echo $initial_state_json; ?></script>
    <!-- Setup Screen -->
    <div id="setupScreen" class="screen <?php if ($current_screen === 'setup') echo 'active'; ?>">
        <div class="setup-screen__container">
            <h1>🎯 Pro Darts Scorer</h1>
            
            <div class="form-group">
                <label class="form-group__label">Game Type</label>
                <select id="gameType">
                    <option value="301">301</option>
                    <option value="501" selected>501</option>
                    <option value="701">701</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-group__label">Match Format (First to)</label>
                <select id="matchLegs">
                    <option value="1">1 Leg</option>
                    <option value="3" selected>3 Legs</option>
                    <option value="5">5 Legs</option>
                </select>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="checkoutAssistantToggle" class="checkbox-group__input" checked>
                    <label for="checkoutAssistantToggle" class="checkbox-group__label">Show Checkout Assistant</label>
                </div>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="soundEffectsToggle" class="checkbox-group__input" checked>
                    <label for="soundEffectsToggle" class="checkbox-group__label">Enable Sound Effects</label>
                </div>
            </div>

            <div class="form-group">
                <label class="form-group__label">Add Players</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="newPlayerName" class="form-group__input" placeholder="Enter name...">
                    <button class="btn btn--secondary" id="addPlayerBtn" style="width: auto; margin: 0;">+</button>
                </div>
            </div>

            <div class="form-group">
                <label class="form-group__label">Players in Game</label>
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
        <header class="game-screen__header">
            <a href="../api.php?action=reset" class="header__link-reset">← New Game</a> 
            <span id="legDisplay" class="game-screen__leg-display"></span>
        </header>

        <div class="active-player-display">
            <div class="active-player-display__name" id="activeName"></div>
            <div class="active-player-display__score" id="activeScore"></div>
            <div class="active-player-display__avg" id="activeAvg"></div>
            <div class="active-player-display__checkout-hint" id="checkoutHint"></div>
        </div>

        <div id="burnDownChartContainer" class="game-screen__chart-container"></div>

        <div class="leaderboard" id="leaderboard"></div>

        <div class="game-screen__controls controls">
            <div class="controls__darts-display" id="dartsThrownDisplay"></div>
            <div class="controls__input-display" id="inputDisplay">0</div>
            <div class="dartboard-keypad">
                <div class="dartboard-keypad__modifiers">
                    <button class="key key--mod" id="modDouble">D</button>
                    <button class="key key--mod" id="modTreble">T</button>
                    <button class="key key--special" data-score="0">MISS</button>
                    <button class="key key--special key--del" id="undoBtn">UNDO</button>
                </div>
                <div class="dartboard-keypad__numbers numbers"></div>
                <div class="dartboard-keypad__specials specials">
                    <button class="key key--bull" data-score="25">OUTER BULL</button>
                    <button class="key key--bull" data-score="50">BULLSEYE</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Stats Screen -->
    <div id="statsScreen" class="screen">
        <header class="stats-screen__header">
            <a href="#" onclick="showScreen('setupScreen')" class="header__link-reset">← Back to Setup</a>
            <span class="stats-screen__title">Player Statistics</span>
        </header>
        <div class="stats-screen__container">
            <div class="player-stats-list">
                <h2 class="player-stats-list__title">Registered Players</h2>
                <ul id="registeredPlayersUl" class="player-stats-list__list"></ul>
            </div>
            <div class="player-stats-details" id="playerStatsDetails"> <!-- ID kept for JS targeting -->
                <h2 class="player-stats-details__title">Select a Player</h2>
                <p class="player-stats-details__message">Click on a player from the list to see their detailed stats.</p>
                <div id="avgChartContainer" class="player-stats-details__avg-chart"></div>
                <div id="h2hStatsContainer" class="player-stats-details__h2h-stats"></div>
            </div>
        </div>
    </div>

    <!-- Match History Screen -->
    <div id="matchHistoryScreen" class="screen">
        <header class="match-history-screen__header">
            <a href="#" onclick="showScreen('setupScreen')" class="header__link-reset">← Back to Setup</a>
            <span class="match-history-screen__title">Match History</span>
        </header>
        <div class="match-history-screen__container" id="matchHistoryContainer">
            <p class="match-history-screen__message">Loading match history...</p>
        </div>
    </div>

    <!-- Match Summary Screen -->
    <div id="matchSummaryScreen" class="screen <?php if ($current_screen === 'summary') echo 'active'; ?>">
        <!-- This is now a skeleton. JS will render the summary. -->
        <div class="match-summary-screen__container">
            <h2 class="match-summary-screen__title">Match Over!</h2>
            <h3 id="matchWinnerName" class="match-summary-screen__winner-name"></h3>
            <div id="matchSummaryTableContainer" class="match-summary-screen__table-container"></div>
            <a href="../api.php?action=reset" class="btn match-summary-screen__new-match-btn" style="max-width: 250px; text-decoration: none;">Start New Match</a> 
        </div>
    </div>

    <!-- Win Modal (for leg wins) -->
    <div id="winModal" class="modal">
        <h2 id="modalWinnerText" class="modal__title">WINNER!</h2>
        <div class="modal__confetti">Game Shot!</div>
        <div class="modal__stats" id="winnerStats"></div>
        <button class="btn modal__button" id="nextLegBtn" style="max-width: 200px;">Start Next Leg</button>
    </div>

    <!-- Audio Elements -->
    <audio id="dartHitSound" src="sounds/click.mp3" preload="auto"></audio>
    <audio id="bustSound" src="sounds/bust.mp3" preload="auto"></audio>
    <audio id="oneEightySound" src="sounds/180.mp3" preload="auto"></audio>
    <audio id="winSound" src="sounds/win.mp3" preload="auto"></audio>

<script src="js/app.js" defer></script>
</body>
</html>