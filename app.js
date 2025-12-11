// --- Game State ---
let players = [];
let currentPlayerIndex = 0;
let startScore = 501;
let currentInput = "";

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
            dartsThrown: 0
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

function startGame() {
    if (players.length === 0) {
        alert("Please add at least one player.");
        return;
    }
    startScore = parseInt(document.getElementById('gameType').value);
    
    // Initialize scores
    players.forEach(p => p.score = startScore);
    
    document.getElementById('setupScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    updateUI();
}

// --- Game Logic ---

function pressKey(num) {
    if (currentInput.length < 3) { 
        currentInput += num;
        updateInputDisplay();
    }
}

function deleteChar() {
    currentInput = currentInput.slice(0, -1);
    updateInputDisplay();
}

function clearInput() {
    currentInput = "";
    updateInputDisplay();
}

function updateInputDisplay() {
    const display = document.getElementById('inputDisplay');
    display.innerText = currentInput === "" ? "0" : currentInput;
}

function submitScore() {
    const scoreThrown = parseInt(currentInput) || 0;
    const player = players[currentPlayerIndex];

    if (scoreThrown > 180) {
        alert("Maximum score for 3 darts is 180.");
        clearInput();
        return;
    }

    const newScore = player.score - scoreThrown;

    if (newScore === 0) {
        // WIN
        player.score = 0;
        // Update stats one last time (assuming 3 darts used for the out)
        player.totalPointsScored += scoreThrown;
        player.dartsThrown += 3;
        showWinScreen(player);
        return;
    } else if (newScore < 0 || newScore === 1) {
        // BUST
        alert("BUST!");
        // In a bust, darts are still thrown, but 0 points are accredited to the 'score remaining'
        // However, for pure average calculation, standard rules usually count the throws but 0 score.
        // We will count the 3 darts thrown, but 0 points gained towards average.
        player.dartsThrown += 3;
    } else {
        // Valid Throw
        player.score = newScore;
        player.totalPointsScored += scoreThrown;
        player.dartsThrown += 3; // Assuming 3 darts thrown per turn
    }

    clearInput();
    nextTurn();
}

function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateUI();
}

function getAverage(player) {
    if (player.dartsThrown === 0) return "0.00";
    return ((player.totalPointsScored / player.dartsThrown) * 3).toFixed(2);
}

function updateUI() {
    const player = players[currentPlayerIndex];
    
    // Main Display
    document.getElementById('activeName').innerText = player.name;
    document.getElementById('activeScore').innerText = player.score;
    document.getElementById('activeAvg').innerText = `Avg: ${getAverage(player)}`;
    
    // Checkout Hint
    const checkout = getCheckoutGuide(player.score);
    document.getElementById('checkoutHint').innerText = checkout ? `Checkout: ${checkout}` : "";

    // Leaderboard
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = players.map((p, index) => `
        <div class="player-card ${index === currentPlayerIndex ? 'active' : ''}">
            <span class="p-name">${p.name}</span>
            <span class="p-score">${p.score}</span>
            <span class="p-avg">Avg: ${getAverage(p)}</span>
        </div>
    `).join('');
    
    // Scroll active player into view
    const activeCard = document.querySelector('.player-card.active');
    if(activeCard) activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function showWinScreen(player) {
    document.getElementById('winnerText').innerText = `${player.name} Wins!`;
    document.getElementById('winnerStats').innerText = `Final 3-Dart Avg: ${getAverage(player)}`;
    document.getElementById('winModal').style.display = 'flex';
}

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