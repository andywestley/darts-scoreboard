// --- Game State ---
let match = {}; // The single source of truth for the entire match state.

let currentThrow = { // Holds state for the current dart being entered
    base: null,
    multiplier: 1, // 1 for single, 2 for double, 3 for treble
};

// --- API & Player Data ---
const API_BASE_URL = 'http://127.0.0.1:5001'; // URL of your Python server
const API_KEY = "your-super-secret-key"; // IMPORTANT: Must match the key in server.py
let allRegisteredPlayers = {}; // Stores players loaded from the server, indexed by name

// --- DOM Element Cache ---
const dom = {
    // A new player list is needed for the setup screen, separate from the match players
    setupPlayers: [],
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
    matchSummaryScreen: null,
    matchHistoryScreen: null,
};


// --- Setup Logic ---
function addPlayer() {
    const input = document.getElementById('newPlayerName');
    const name = input.value.trim();
    if (name && !dom.setupPlayers.find(p => p.name === name)) {
        // Added stats tracking: totalPointsScored and dartsThrown
        dom.setupPlayers.push({ 
            name: name, 
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
    dom.setupPlayers = dom.setupPlayers.filter(p => p.id !== id);
    renderPlayerList();
}

function renderPlayerList() {
    const list = document.getElementById('playerList');
    list.innerHTML = dom.setupPlayers.map(p => `
        <div class="player-tag">
            <span>${p.name}</span>
            <span class="remove-btn" onclick="removePlayer(${p.id})">×</span>
        </div>
    `).join('');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'statsScreen') {
        renderStatsPlayerList();
    } else if (screenId === 'matchHistoryScreen') {
        loadMatchHistory();
    }
}

function startGame() {
    if (dom.setupPlayers.length === 0) {
        alert("Please add at least one player.");
        return;
    }

    // Initialize the main match object
    match = {
        players: JSON.parse(JSON.stringify(dom.setupPlayers)), // Deep copy to prevent side effects
        settings: {
            startScore: parseInt(document.getElementById('gameType').value),
            legsToWin: parseInt(document.getElementById('matchLegs').value),
            useCheckoutAssistant: document.getElementById('checkoutAssistantToggle').checked,
        },
        currentLeg: {
            number: 1,
            startingPlayerIndex: 0,
            currentPlayerIndex: 0,
            turnScores: [],
            history: [],
        },
        isOver: false,
    };

    // Reset player scores and leg-specific stats for the first leg
    match.players.forEach(p => {
        p.score = match.settings.startScore;
        p.legsWon = 0; // Ensure legs won is reset for a new match
        // Add match-long stat trackers
        p.matchDartsThrown = 0;
        p.matchTotalPointsScored = 0;
    });

    startNewLeg(true); // Start the first leg
    showScreen('gameScreen');
    initGameUI();
}

function initGameUI() {
    generateNumberButtons(); // Generate number pad

    // Create player cards in the leaderboard
    dom.leaderboard.innerHTML = match.players.map(p => `
        <div class="player-card">
            <span class="p-name">${p.name}</span>
            <span class="p-score">${match.settings.startScore}</span>
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
    const leg = match.currentLeg;
    leg.history.push(JSON.parse(JSON.stringify({ players: match.players, leg })));

    const player = match.players[leg.currentPlayerIndex];

    // Basic validation
    if (dartScore > 180) { // Should not happen with new UI, but good practice
        alert("Invalid score.");
        return;
    }

    leg.turnScores.push(dartScore);
    player.dartsThrown += 1;
    player.totalPointsScored += dartScore;
    // Also update match-long stats
    player.matchDartsThrown += 1;
    player.matchTotalPointsScored += dartScore;

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
            const turnTotal = leg.turnScores.reduce((a, b) => a + b, 0);
            player.score += turnTotal;
            player.totalPointsScored -= turnTotal;
            player.dartsThrown += (3 - leg.turnScores.length); // Penalize with remaining darts
            player.legTurnScores.push(leg.turnScores.reduce((a, b) => a + b, 0)); // Record turn score for stats
            nextTurn();
            return;
        }
    } else if (player.score < 0 || player.score === 1) {
        // BUST!
        alert("BUST!");
        // Revert score and stats for the turn
        const turnTotal = leg.turnScores.reduce((a, b) => a + b, 0);
        player.score += turnTotal;
        player.totalPointsScored -= turnTotal;
        // Darts thrown still count
        player.legTurnScores.push(leg.turnScores.reduce((a, b) => a + b, 0)); // Record turn score for stats
        
        // Fill remaining darts thrown for the turn for stat purposes
        player.dartsThrown += (3 - leg.turnScores.length);

        nextTurn();
        return;
    }
    
    // Reset for next dart
    currentThrow = { base: null, multiplier: 1 };
    updateUI();

    // If 3 darts are thrown, move to next player
    if (leg.turnScores.length === 3) {
        nextTurn();
    }
}

function undoLastDart() {
    if (match.currentLeg.history.length === 0) return;

    const lastState = match.currentLeg.history.pop();
    match.players = lastState.players;
    match.currentLeg = lastState.leg;

    // Reset current throw state
    currentThrow = { base: null, multiplier: 1 };

    updateUI();
}


function nextTurn() {
    // Use a timeout to allow the player to see the result of their last dart
    // Record the turn score for the current player before switching
    const player = match.players[match.currentLeg.currentPlayerIndex];
    player.legTurnScores.push(match.currentLeg.turnScores.reduce((a, b) => a + b, 0));

    setTimeout(() => {
        match.currentLeg.currentPlayerIndex = (match.currentLeg.currentPlayerIndex + 1) % match.players.length;
        match.currentLeg.turnScores = [];
        currentThrow = { base: null, multiplier: 1 };
        updateUI();
    }, 800);
}

function getAverage(player) {
    if (player.dartsThrown === 0) return "0.00";
    return ((player.totalPointsScored / player.dartsThrown) * 3).toFixed(2);
}

function getMatchAverage(player) {
    if (player.matchDartsThrown === 0) return "0.00";
    return ((player.matchTotalPointsScored / player.matchDartsThrown) * 3).toFixed(2);
}

function updateUI() {
    if (!match.players || match.players.length === 0 || !dom.gameScreen.classList.contains('active')) return;
    const leg = match.currentLeg;
    const player = match.players[leg.currentPlayerIndex];
    
    // Main Display
    dom.activeName.innerText = player.name;
    dom.activeScore.innerText = player.score;
    dom.activeAvg.innerText = `Avg: ${getAverage(player)}`;
    
    // Update header to show match score
    const matchScore = match.players.map(p => `${p.name.split(' ')[0]} (${p.legsWon})`).join(' - ');
    dom.legDisplay.innerText = `Leg ${leg.number} | ${matchScore}`;
    
    // Checkout Hint
    if (match.settings.useCheckoutAssistant) {
        const checkout = getCheckoutGuide(player.score);
        dom.checkoutHint.innerText = checkout ? `Checkout: ${checkout}` : "";
    } else {
        dom.checkoutHint.innerText = ""; // Ensure it's cleared if disabled
    }

    // Darts thrown display
    dom.dartsThrownSpans.forEach((span, i) => {
        span.innerText = leg.turnScores[i] !== undefined ? leg.turnScores[i] : '-';
        span.classList.toggle('active', i === leg.turnScores.length);
    });

    // Update multiplier buttons
    dom.modDouble.classList.toggle('active', currentThrow.multiplier === 2);
    dom.modTreble.classList.toggle('active', currentThrow.multiplier === 3);
    updateInputDisplay();

    // Leaderboard
    const cards = dom.leaderboard.children;
    match.players.forEach((p, index) => {
        const card = cards[index];
        if (card) {
            card.children[1].innerText = p.score; // Update score
            card.children[2].innerText = `Avg: ${getAverage(p)}`; // Update average
            card.classList.toggle('active', index === leg.currentPlayerIndex);
        }
    });
    
    // Scroll active player into view
    const activeCard = document.querySelector('.player-card.active');
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    drawBurnDownChart();
}

function showWinScreen(player) {
    player.legsWon += 1;
    saveGameStats(player.name); // Save stats to server

    // Check for match win
    if (player.legsWon >= match.settings.legsToWin) {
        showMatchSummary(player);
    } else {
        // Just a leg win
        document.getElementById('winnerText').innerText = `${player.name} Wins the Leg!`;
        dom.winModal.querySelector('.btn').setAttribute('onclick', 'startNewLeg()');
        dom.winModal.querySelector('.btn').innerText = 'Start Next Leg';
    }

    dom.winModal.querySelector('#winnerStats').innerText = `Final 3-Dart Avg: ${getAverage(player)}`;
    dom.winModal.style.display = 'flex';
}

function showMatchSummary(winner) {
    match.isOver = true;
    saveMatchRecord(winner); // Save the final match record to the server
    dom.matchSummaryScreen.style.display = 'flex';

    document.getElementById('matchWinnerName').innerText = `${winner.name} wins the match ${winner.legsWon} - ${match.players.find(p => p.name !== winner.name)?.legsWon || 0}!`;

    const summaryBody = document.getElementById('matchSummaryBody');
    summaryBody.innerHTML = ''; // Clear previous summary

    // Sort players by legs won for the summary table
    const sortedPlayers = [...match.players].sort((a, b) => b.legsWon - a.legsWon);

    sortedPlayers.forEach(p => {
        const row = document.createElement('tr');
        if (p.name === winner.name) row.classList.add('winner-row');
        row.innerHTML = `<td>${p.name}</td><td>${p.legsWon}</td><td>${getMatchAverage(p)}</td>`;
        summaryBody.appendChild(row);
    });
}

function startNewLeg(isFirstLeg = false) {
    if (!isFirstLeg) {
        match.currentLeg.number += 1;
        // Cycle starting player for the new leg
        match.currentLeg.startingPlayerIndex = (match.currentLeg.startingPlayerIndex + 1) % match.players.length;
    }

    match.currentLeg.currentPlayerIndex = match.currentLeg.startingPlayerIndex;
    match.currentLeg.turnScores = [];
    match.currentLeg.history = [];

    // Reset scores and leg-specific stats for all players
    match.players.forEach(p => {
        p.score = match.settings.startScore;
        p.legTurnScores = []; // Clear turn scores for the new leg
        p.totalPointsScored = 0;
        p.dartsThrown = 0;
    });

    currentThrow = { base: null, multiplier: 1 };
    if (dom.winModal) dom.winModal.style.display = 'none';

    if (!isFirstLeg) updateUI();
}

// --- API Communication ---

async function saveGameStats(winnerName) {
    if (Object.keys(allRegisteredPlayers).length === 0) return; // Don't save if server is offline or no players

    const playerUpdates = match.players.map(p => {
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

async function saveMatchRecord(winner) {
    if (Object.keys(allRegisteredPlayers).length === 0) return; // Don't save if server is offline

    const finalStandings = [...match.players]
        .sort((a, b) => b.legsWon - a.legsWon)
        .map(p => ({
            name: p.name,
            legsWon: p.legsWon,
            matchAverage: getMatchAverage(p)
        }));

    const matchData = {
        winner: winner.name,
        standings: finalStandings,
        settings: {
            startScore: match.settings.startScore,
            legsToWin: match.settings.legsToWin,
            checkoutAssistantUsed: match.settings.useCheckoutAssistant,
        },
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/matches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(matchData)
        });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        console.log("Match record saved successfully.");
    } catch (error) {
        console.error("Failed to save match record:", error);
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

async function displayPlayerStats(playerName) {
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

    // --- Head-to-Head Stats ---
    const h2hStatsHtml = await renderHeadToHeadStats(playerName);

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
        <div id="avgChartContainer"></div>
        <hr>
        <h3>Head-to-Head Record:</h3>
        ${h2hStatsHtml}
    `;

    // Now that the container exists in the DOM, draw the chart
    drawAverageHistoryChart(player.averageHistory);
}

function drawBurnDownChart() {
    const container = document.getElementById('burnDownChartContainer');
    if (!container || !google.visualization) return;

    const leg = match.currentLeg;
    const history = leg.history;
    const players = match.players;

    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('number', 'Darts Thrown');
    players.forEach(p => dataTable.addColumn('number', p.name));

    // Add the starting point (0 darts thrown)
    const initialRow = [0, ...players.map(() => match.settings.startScore)];
    dataTable.addRow(initialRow);

    // Add a row for each dart thrown in the history
    history.forEach((state, index) => {
        const dartNumber = index + 1;
        const scores = state.players.map(p => p.score);
        dataTable.addRow([dartNumber, ...scores]);
    });
    // Add the current state after the last dart
    if (history.length > 0) {
         const currentScores = players.map(p => p.score);
         dataTable.addRow([history.length + leg.turnScores.length, ...currentScores]);
    }

    const options = {
        title: 'Score Burn-Down',
        titleTextStyle: { color: '#FFF' },
        curveType: 'none', // Use straight lines
        legend: { position: 'top', textStyle: { color: '#CCC' } },
        backgroundColor: 'transparent',
        chartArea: { backgroundColor: 'transparent', width: '85%', height: '65%' },
        hAxis: { 
            title: 'Darts Thrown in Leg',
            titleTextStyle: { color: '#999' },
            textStyle: { color: '#999' } 
        },
        vAxis: { 
            textStyle: { color: '#999' },
            gridlines: { color: '#444' },
            baselineColor: '#666'
        },
    };

    const chart = new google.visualization.LineChart(container);
    chart.draw(dataTable, options);
}

function drawAverageHistoryChart(history) {
    const container = document.getElementById('avgChartContainer');
    const data = history.slice(-10).map(Number);

    if (data.length < 2) {
        container.innerHTML = '<p>Not enough data to display a chart.</p>';
        return;
    }

    const chartData = new google.visualization.DataTable();
    chartData.addColumn('string', 'Game');
    chartData.addColumn('number', 'Average');

    data.forEach((avg, i) => {
        chartData.addRow([`Game ${i + 1}`, avg]);
    });

    const options = {
        title: '3-Dart Average Trend',
        titleTextStyle: { color: '#FFF' },
        curveType: 'function',
        legend: { position: 'none' },
        backgroundColor: 'transparent',
        chartArea: { backgroundColor: 'transparent', width: '85%', height: '70%' },
        hAxis: { textStyle: { color: '#999' } },
        vAxis: { 
            textStyle: { color: '#999' },
            gridlines: { color: '#444' },
            baselineColor: '#666'
        },
        colors: ['#00d2be'], // --accent-color
        pointsVisible: true,
        pointSize: 5,
    };

    const chart = new google.visualization.LineChart(container);
    chart.draw(chartData, options);
}

async function renderHeadToHeadStats(playerName) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/matches`);
        if (!response.ok) throw new Error('Failed to fetch matches for H2H stats');
        const allMatches = await response.json();

        const h2hRecords = {};

        for (const match of allMatches) {
            const playerInMatch = match.standings.find(p => p.name === playerName);
            if (!playerInMatch) continue; // Player wasn't in this match

            for (const opponent of match.standings) {
                if (opponent.name === playerName) continue; // Don't compare to self

                // Initialize opponent record if it doesn't exist
                if (!h2hRecords[opponent.name]) {
                    h2hRecords[opponent.name] = { wins: 0, losses: 0 };
                }

                if (match.winner === playerName) {
                    h2hRecords[opponent.name].wins += 1;
                } else if (match.winner === opponent.name) {
                    h2hRecords[opponent.name].losses += 1;
                }
            }
        }

        if (Object.keys(h2hRecords).length === 0) {
            return '<p>No head-to-head matches recorded.</p>';
        }

        let tableHtml = '<table class="h2h-table"><thead><tr><th>Opponent</th><th>Record (W-L)</th></tr></thead><tbody>';
        for (const opponentName in h2hRecords) {
            tableHtml += `<tr><td>${opponentName}</td><td>${h2hRecords[opponentName].wins} - ${h2hRecords[opponentName].losses}</td></tr>`;
        }
        return tableHtml + '</tbody></table>';
    } catch (error) {
        console.error("Could not render H2H stats:", error);
        return '<p style="color: var(--danger-color);">Could not load head-to-head data.</p>';
    }
}

// --- Match History Screen ---

async function loadMatchHistory() {
    const container = document.getElementById('matchHistoryContainer');
    container.innerHTML = '<p>Loading match history...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/matches`);
        if (!response.ok) throw new Error('Failed to fetch match history');
        const matches = await response.json();
        renderMatchHistory(matches);
    } catch (error) {
        console.error("Could not load match history:", error);
        container.innerHTML = '<p style="color: var(--danger-color);">Error loading match history. Is the server running?</p>';
    }
}

function renderMatchHistory(matches) {
    const container = document.getElementById('matchHistoryContainer');
    if (matches.length === 0) {
        container.innerHTML = '<p>No completed matches found.</p>';
        return;
    }

    container.innerHTML = matches.map((match, index) => {
        const winner = match.standings[0];
        const opponent = match.standings[1];
        const score = `${winner.legsWon} - ${opponent ? opponent.legsWon : 0}`;
        const date = new Date(match.timestamp).toLocaleString();

        return `
            <div class="match-card">
                <div class="match-card-header" onclick="toggleMatchDetails(${index})">
                    <div>
                        <span class="match-card-winner"><span class="winner-icon">🏆</span> ${winner.name}</span>
                        <span>vs ${opponent ? opponent.name : '...'} (${score})</span>
                    </div>
                    <span class="match-card-date">${date}</span>
                </div>
                <div class="match-card-details" id="match-details-${index}">
                    <table class="summary-table">
                        <thead><tr><th>Player</th><th>Legs Won</th><th>Match Avg</th></tr></thead>
                        <tbody>
                            ${match.standings.map(p => `<tr><td>${p.name}</td><td>${p.legsWon}</td><td>${p.matchAverage}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

function toggleMatchDetails(index) {
    const details = document.getElementById(`match-details-${index}`);
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
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
    dom.setupPlayers = [];
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
    dom.matchSummaryScreen = document.getElementById('matchSummaryScreen');
    dom.matchHistoryScreen = document.getElementById('matchHistoryScreen');

    // Load Google Charts library
    google.charts.load('current', { 'packages': ['corechart'] });

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