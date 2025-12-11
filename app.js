// --- Game State ---
let players = [];
let currentPlayerIndex = 0;
let startScore = 501;
let turnScores = []; // Holds scores for the 3 darts in a turn
let currentThrow = { // Holds state for the current dart being entered
    base: null,
    multiplier: 1, // 1 for single, 2 for double, 3 for treble
};
let gameHistory = []; // To store state for the undo feature

// --- API & Player Data ---
const API_BASE_URL = 'http://127.0.0.1:5001'; // URL of your Python server
const API_KEY = "your-super-secret-key"; // IMPORTANT: Must match the key in server.py
let allRegisteredPlayers = {}; // Stores players loaded from the server, indexed by name
let leg = 1;

// --- DOM Element Cache ---
const dom = {
    setupScreen: null,
    gameScreen: null,
    statsScreen: null,
    activeName: null,
    activeScore: null,
    activeAvg: null,
    checkoutHint: null,
    dartsThrownSpans: [],
    leaderboard: null,
    modDouble: null,
    modTreble: null,
    inputDisplay: null,
    legDisplay: null,
    winModal: null,
};


// --- Setup Logic ---
function addPlayer() {
    const input = document.getElementById('newPlayerName');
    const name = input.value.trim();
    if (name) {
        // Added stats tracking: totalPointsScored and dartsThrown
        players.push({ 
            name: name, 
            score: 0, 
            id: Date.now(),
            totalPointsScored: 0,
            dartsThrown: 0,
            legsWon: 0,
            legTurnScores: [] // To track turn totals for stats
        });
        renderPlayerList();
        input.value = '';
        input.focus();
    }
}

document.getElementById('newPlayerName').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addPlayer();
});

function removePlayer(id) {
    players = players.filter(p => p.id !== id);
    renderPlayerList();
}

function renderPlayerList() {
    const list = document.getElementById('playerList');
    list.innerHTML = players.map(p => `
        <div class="player-tag">
            <span>${p.name}</span>
            <span class="remove-btn" onclick="removePlayer(${p.id})">×</span>
        </div>
    `).join('');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'statsScreen') renderStatsPlayerList();
}

function startGame() {
    if (players.length === 0) {
        alert("Please add at least one player.");
        return;
    }
    startScore = parseInt(document.getElementById('gameType').value);
    
    // Initialize scores
    players.forEach(p => {
        p.score = startScore;
        p.totalPointsScored = 0;
        p.dartsThrown = 0;
        p.legTurnScores = [];
    });
    
    leg = 1;
    showScreen('gameScreen');
    
    turnScores = [];
    gameHistory = [];
    initGameUI();
    updateUI();
}

function initGameUI() {
    generateNumberButtons(); // Generate number pad

    // Create player cards in the leaderboard
    dom.leaderboard.innerHTML = players.map(p => `
        <div class="player-card">
            <span class="p-name">${p.name}</span>
            <span class="p-score">${startScore}</span>
            <span class="p-avg">Avg: 0.00</span>
        </div>
    `).join('');

    // Re-run initial UI update to set the first active player
    updateUI();
}

// --- Game Logic ---

function generateNumberButtons() {
    const container = document.querySelector('.numbers');
    if (container.children.length > 0) return; // Only generate once
    container.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
        const btn = document.createElement('button');
        btn.className = 'key';
        btn.innerText = i;
        btn.onclick = () => selectNumber(i);
        container.appendChild(btn);
    }
}

function selectMultiplier(multiplier) {
    // Toggle off if the same multiplier is clicked again
    if (currentThrow.multiplier === multiplier) {
        currentThrow.multiplier = 1;
    } else {
        currentThrow.multiplier = multiplier;
    }
    updateUI();
}

function selectNumber(number) {
    currentThrow.base = number;
    const score = currentThrow.base * currentThrow.multiplier;
    submitScore(score);
}

function enterSpecial(score) {
    // For special scores, there's no base number or multiplier
    currentThrow.base = null;
    currentThrow.multiplier = 1;
    submitScore(score);
}

function updateInputDisplay() {
    const display = document.getElementById('inputDisplay');
    const score = currentThrow.base ? (currentThrow.base * currentThrow.multiplier) : 0;
    display.innerText = score;
}

function submitScore(dartScore) {
    // Save current state for undo
    gameHistory.push(JSON.parse(JSON.stringify({ players, currentPlayerIndex, turnScores })));

    const player = players[currentPlayerIndex];

    // Basic validation
    if (dartScore > 180) { // Should not happen with new UI, but good practice
        alert("Invalid score.");
        return;
    }

    turnScores.push(dartScore);
    player.dartsThrown += 1;
    player.totalPointsScored += dartScore;
    player.score -= dartScore;

    // --- Check for Win or Bust ---
    if (player.score === 0) {
        // A score of 0 is only a win if the last dart was a double or a bullseye.
        const isDoubleOut = (currentThrow.multiplier === 2) || (dartScore === 50);

        if (isDoubleOut) {
            // VALID WIN!
            updateUI(); // Update to show the final dart
            setTimeout(() => showWinScreen(player), 200); // Short delay to see the final score
            return;
        } else {
            // BUST! Invalid checkout (not a double).
            alert("BUST! You must finish on a double.");
            // Revert score and stats for the turn
            const turnTotal = turnScores.reduce((a, b) => a + b, 0);
            player.score += turnTotal;
            player.totalPointsScored -= turnTotal;
            player.dartsThrown += (3 - turnScores.length); // Penalize with remaining darts
            player.legTurnScores.push(turnScores.reduce((a, b) => a + b, 0)); // Record turn score for stats
            nextTurn();
            return;
        }
    } else if (player.score < 0 || player.score === 1) {
        // BUST!
        alert("BUST!");
        // Revert score and stats for the turn
        const turnTotal = turnScores.reduce((a, b) => a + b, 0);
        player.score += turnTotal;
        player.totalPointsScored -= turnTotal;
        // Darts thrown still count
        player.legTurnScores.push(turnScores.reduce((a, b) => a + b, 0)); // Record turn score for stats
        
        // Fill remaining darts thrown for the turn for stat purposes
        player.dartsThrown += (3 - turnScores.length);

        nextTurn();
        return;
    }
    
    // Reset for next dart
    currentThrow = { base: null, multiplier: 1 };
    updateUI();

    // If 3 darts are thrown, move to next player
    if (turnScores.length === 3) {
        nextTurn();
    }
}

function undoLastDart() {
    if (gameHistory.length === 0) return;

    const lastState = gameHistory.pop();
    players = lastState.players;
    currentPlayerIndex = lastState.currentPlayerIndex;
    turnScores = lastState.turnScores;

    // Reset current throw state
    currentThrow = { base: null, multiplier: 1 };

    updateUI();
}


function nextTurn() {
    // Use a timeout to allow the player to see the result of their last dart
    // Record the turn score for the current player before switching
    const player = players[currentPlayerIndex];
    player.legTurnScores.push(turnScores.reduce((a, b) => a + b, 0));

    setTimeout(() => {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        turnScores = [];
        currentThrow = { base: null, multiplier: 1 };
        updateUI();
    }, 800);
}

function getAverage(player) {
    if (player.dartsThrown === 0) return "0.00";
    return ((player.totalPointsScored / player.dartsThrown) * 3).toFixed(2);
}

function updateUI() {
    if (players.length === 0 || !dom.gameScreen.classList.contains('active')) return;
    const player = players[currentPlayerIndex];
    
    // Main Display
    dom.activeName.innerText = player.name;
    dom.activeScore.innerText = player.score;
    dom.activeAvg.innerText = `Avg: ${getAverage(player)}`;
    dom.legDisplay.innerText = `Leg ${leg}`;
    
    // Checkout Hint
    const checkout = getCheckoutGuide(player.score);
    dom.checkoutHint.innerText = checkout ? `Checkout: ${checkout}` : "";

    // Darts thrown display
    dom.dartsThrownSpans.forEach((span, i) => {
        span.innerText = turnScores[i] !== undefined ? turnScores[i] : '-';
        span.classList.toggle('active', i === turnScores.length);
    });

    // Update multiplier buttons
    dom.modDouble.classList.toggle('active', currentThrow.multiplier === 2);
    dom.modTreble.classList.toggle('active', currentThrow.multiplier === 3);
    updateInputDisplay();

    // Leaderboard
    const cards = dom.leaderboard.children;
    players.forEach((p, index) => {
        const card = cards[index];
        if (card) {
            card.children[1].innerText = p.score; // Update score
            card.children[2].innerText = `Avg: ${getAverage(p)}`; // Update average
            card.classList.toggle('active', index === currentPlayerIndex);
        }
    });
    
    // Scroll active player into view
    const activeCard = document.querySelector('.player-card.active');
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function showWinScreen(player) {
    document.getElementById('winnerText').innerText = `${player.name} Wins!`;
    player.legsWon += 1;
    saveGameStats(player.name); // Save stats to server
    dom.winModal.querySelector('#winnerStats').innerText = `Final 3-Dart Avg: ${getAverage(player)}`;
    dom.winModal.style.display = 'flex';
    // Override the play again button to reset the leg, not the whole game
    dom.winModal.querySelector('.btn').setAttribute('onclick', 'startNewLeg()');
    dom.winModal.querySelector('.btn').innerText = 'Start Next Leg';
}

function startNewLeg() {
    // Reset scores, keep players and legs won
    players.forEach(p => {
        p.score = startScore;
        p.legTurnScores = []; // Clear turn scores for the new leg
        // Reset stats for the new leg, but keep legsWon
        p.totalPointsScored = 0;
        p.dartsThrown = 0;
    });
    leg += 1;
    currentPlayerIndex = 0; // Or cycle starting player
    turnScores = [];
    gameHistory = [];
    currentThrow = { base: null, multiplier: 1 };
    dom.winModal.style.display = 'none';

    // No need to re-initialize, just update
    updateUI();

}

// --- API Communication ---

async function saveGameStats(winnerName) {
    if (!allRegisteredPlayers) return; // Don't save if server is offline

    const playerUpdates = players.map(p => {
        const registeredPlayer = allRegisteredPlayers[p.name] || {};
        
        // Update turn score frequency
        const turnScoreFrequency = registeredPlayer.turnScoreFrequency || {};
        p.legTurnScores.forEach(score => {
            turnScoreFrequency[score] = (turnScoreFrequency[score] || 0) + 1;
        });

        // Update average history
        const legAverage = getAverage(p);
        const averageHistory = registeredPlayer.averageHistory || [];
        if (parseFloat(legAverage) > 0) {
            averageHistory.push(legAverage);
        }

        return {
            name: p.name,
            gamesPlayed: (registeredPlayer.gamesPlayed || 0) + 1,
            gamesWon: (registeredPlayer.gamesWon || 0) + (p.name === winnerName ? 1 : 0),
            totalPointsScored: (registeredPlayer.totalPointsScored || 0) + p.totalPointsScored,
            totalDartsThrown: (registeredPlayer.totalDartsThrown || 0) + p.dartsThrown,
            legsWon: (registeredPlayer.legsWon || 0) + (p.name === winnerName ? 1 : 0),
            turnScoreFrequency: turnScoreFrequency,
            averageHistory: averageHistory.slice(-10) // Keep only the last 10
        };
    });

    try {
        const response = await fetch(`${API_BASE_URL}/api/players/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(playerUpdates)
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        console.log("Game stats saved successfully.");
    } catch (error) {
        console.error("Failed to save game stats:", error);
    }
}

// --- Stats Screen Logic ---

function renderStatsPlayerList() {
    const ul = document.getElementById('registeredPlayersUl');
    ul.innerHTML = ''; // Clear existing list

    const playerNames = Object.keys(allRegisteredPlayers).sort();

    if (playerNames.length === 0) {
        ul.innerHTML = '<li>No registered players found.</li>';
        return;
    }

    playerNames.forEach(name => {
        const li = document.createElement('li');
        li.innerText = name;
        li.onclick = () => displayPlayerStats(name);
        ul.appendChild(li);
    });
}

function displayPlayerStats(playerName) {
    // Highlight the selected player in the list
    document.querySelectorAll('#registeredPlayersUl li').forEach(li => {
        li.classList.toggle('active-stat-player', li.innerText === playerName);
    });

    const detailsContainer = document.getElementById('playerStatsDetails');
    const player = allRegisteredPlayers[playerName];

    if (!player) {
        detailsContainer.innerHTML = '<h2>Error</h2><p>Player not found.</p>';
        return;
    }

    const overallAverage = (player.totalDartsThrown > 0)
        ? ((player.totalPointsScored / player.totalDartsThrown) * 3).toFixed(2)
        : "0.00";

    const winRate = (player.gamesPlayed > 0)
        ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(1)
        : "0.0";

    // Get top 3 most common turn scores
    const sortedTurnScores = Object.entries(player.turnScoreFrequency || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    let turnScoresHtml = '<ul>';
    if (sortedTurnScores.length > 0) {
        sortedTurnScores.forEach(([score, count]) => {
            turnScoresHtml += `<li><strong>${score}</strong>: ${count} times</li>`;
        });
    } else {
        turnScoresHtml += '<li>No turn scores recorded.</li>';
    }
    turnScoresHtml += '</ul>';

    detailsContainer.innerHTML = `
        <h2>${player.name}</h2>
        <p><strong>Win Rate:</strong> ${winRate}% (${player.gamesWon} wins / ${player.gamesPlayed} played)</p>
        <p><strong>Overall 3-Dart Avg:</strong> ${overallAverage}</p>
        <p><strong>Total Darts Thrown:</strong> ${player.totalDartsThrown}</p>
        <p><strong>Legs Won:</strong> ${player.legsWon || 0}</p>
        <hr>
        <h3>Most Common Turn Scores:</h3>
        ${turnScoresHtml}
        <h3>Average History (last 10 games):</h3>
        <p>${player.averageHistory.slice(-10).join(' | ') || 'No completed games.'}</p>
    `;
}

// --- Initialization ---

async function checkServerStatus() {
    const statusIndicator = document.getElementById('serverStatus');
    const statusText = statusIndicator.querySelector('.status-text');

    try {
        const response = await fetch(`${API_BASE_URL}/api/ping`);
        if (!response.ok) throw new Error('Server not responding');

        const data = await response.json();
        if (data.status === 'ok') {
            statusIndicator.classList.remove('offline');
            statusIndicator.classList.add('online');
            statusText.innerText = 'Server Connected';
            return true;
        }
    } catch (error) {
        console.error("Server check failed:", error);
        statusIndicator.classList.remove('online');
        statusIndicator.classList.add('offline');
        statusText.innerText = 'Server Offline';
        // Disable stats button if server is offline
        document.querySelector("button[onclick=\"showScreen('statsScreen')\"]").disabled = true;
        return false;
    }
}

async function loadRegisteredPlayers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/players`);
        if (!response.ok) throw new Error('Failed to fetch players');
        const playersList = await response.json();

        // Convert array to a dictionary indexed by name for easy lookup
        allRegisteredPlayers = playersList.reduce((acc, player) => {
            acc[player.name] = player;
            return acc;
        }, {});

        console.log("Registered players loaded:", allRegisteredPlayers);
    } catch (error) {
        console.error("Could not load registered players:", error);
        // Ensure the object is empty on failure
        allRegisteredPlayers = {};
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Cache all DOM elements
    dom.setupScreen = document.getElementById('setupScreen');
    dom.gameScreen = document.getElementById('gameScreen');
    dom.statsScreen = document.getElementById('statsScreen');
    dom.activeName = document.getElementById('activeName');
    dom.activeScore = document.getElementById('activeScore');
    dom.activeAvg = document.getElementById('activeAvg');
    dom.checkoutHint = document.getElementById('checkoutHint');
    dom.dartsThrownSpans = Array.from(document.querySelectorAll('#dartsThrownDisplay .dart-score'));
    dom.leaderboard = document.getElementById('leaderboard');
    dom.modDouble = document.getElementById('modDouble');
    dom.modTreble = document.getElementById('modTreble');
    dom.inputDisplay = document.getElementById('inputDisplay');
    dom.legDisplay = document.querySelector('header span');
    dom.winModal = document.getElementById('winModal');

    const isServerOnline = await checkServerStatus();
    if (isServerOnline) {
        await loadRegisteredPlayers();
    }
});


// --- Checkout Logic (Standard Checkouts) ---
function getCheckoutGuide(score) {
    if (score > 170 || score < 2) return null;
    
    const checkouts = {
        170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull",
        160: "T20 T20 D20", 158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18",
        154: "T20 T18 D20", 153: "T20 T19 D18", 152: "T20 T20 D16", 151: "T20 T17 D20",
        150: "T20 T18 D18", 149: "T20 T19 D16", 148: "T20 T16 D20", 147: "T20 T17 D18",
        146: "T20 T18 D16", 145: "T20 T15 D20", 144: "T20 T20 D12", 143: "T20 T17 D16",
        142: "T20 T14 D20", 141: "T20 T19 D12", 140: "T20 T16 D16", 139: "T20 T13 D20",
        138: "T20 T18 D12", 137: "T19 T16 D16", 136: "T20 T20 D8", 135: "T20 T17 D12",
        134: "T20 T14 D16", 133: "T20 T19 D8", 132: "T20 T16 D12", 131: "T20 T13 D16",
        130: "T20 T18 D8", 129: "T19 T20 D6", 128: "T18 T14 D16", 127: "T20 T17 D8",
        126: "T19 T19 D6", 125: "Bull T20 D7", 124: "T20 D16 D16", 123: "T19 T16 D9",
        122: "T18 T20 D4", 121: "T20 T15 D8", 120: "T20 20 D20", 119: "T19 T10 D16",
        118: "T20 18 D20", 117: "T20 17 D20", 116: "T20 16 D20", 115: "T20 15 D20",
        114: "T20 14 D20", 113: "T20 13 D20", 112: "T20 12 D20", 111: "T20 19 D16",
        110: "T20 10 D20", 109: "T20 9 D20", 108: "T20 16 D16", 107: "T19 10 D20",
        106: "T20 14 D16", 105: "T20 13 D16", 104: "T18 10 D20", 103: "T20 3 D20",
        102: "T20 10 D16", 101: "T17 10 D20", 100: "T20 D20", 
        99: "T19 10 D16", 98: "T20 D19", 97: "T19 D20", 96: "T20 D18", 95: "T19 D19",
        94: "T18 D20", 93: "T19 D18", 92: "T20 D16", 91: "T17 D20", 90: "T20 D15",
        89: "T19 D16", 88: "T16 D20", 87: "T17 D18", 86: "T18 D16", 85: "T15 D20",
        84: "T20 D12", 83: "T17 D16", 82: "T14 D20", 81: "T19 D12", 80: "T20 D10",
        79: "T13 D20", 78: "T18 D12", 77: "T19 D10", 76: "T20 D8", 75: "T17 D12",
        74: "T14 D16", 73: "T19 D8", 72: "T16 D12", 71: "T13 D16", 70: "T18 D8",
        69: "T15 D12", 68: "T20 D4", 67: "T17 D8", 66: "T10 D18", 65: "T19 D4",
        64: "T16 D8", 63: "T13 D12", 62: "T10 D16", 61: "T15 D8", 60: "20 D20",
        59: "19 D20", 58: "18 D20", 57: "17 D20", 56: "16 D20", 55: "15 D20",
        54: "14 D20", 53: "13 D20", 52: "12 D20", 51: "11 D20", 50: "10 D20",
        49: "9 D20", 48: "8 D20", 47: "7 D20", 46: "6 D20", 45: "5 D20",
        44: "4 D20", 43: "3 D20", 42: "2 D20", 41: "1 D20", 40: "D20",
        39: "7 D16", 38: "D19", 37: "5 D16", 36: "D18", 35: "3 D16",
        34: "D17", 33: "1 D16", 32: "D16", 31: "15 D8", 30: "D15",
        29: "13 D8", 28: "D14", 27: "11 D8", 26: "D13", 25: "9 D8",
        24: "D12", 23: "7 D8", 22: "D11", 21: "5 D8", 20: "D10",
        19: "3 D8", 18: "D9", 17: "1 D8", 16: "D8", 15: "7 D4",
        14: "D7", 13: "5 D4", 12: "D6", 11: "3 D4", 10: "D5",
        9: "1 D4", 8: "D4", 7: "3 D2", 6: "D3", 5: "1 D2",
        4: "D2", 3: "1 D1", 2: "D1"
    };

    return checkouts[score] || "No Checkout";
}