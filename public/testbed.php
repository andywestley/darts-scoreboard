<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Testbed</title>
    <style>
        :root { --response-height: 220px; }
        body { font-family: sans-serif; background-color: #2c2c2c; color: #f0f0f0; padding: 20px; padding-bottom: calc(var(--response-height) + 20px); }
        .container { max-width: 900px; margin: auto; }
        fieldset { border: 1px solid #444; margin-bottom: 20px; padding: 15px; }
        legend { font-weight: bold; color: #00d1b2; padding: 0 5px; }
        form { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        button { background-color: #00d1b2; color: #1a1a1a; border: none; padding: 8px 12px; cursor: pointer; }
        input[type="text"], input[type="number"] { padding: 8px; }
        .checkbox-label { display: flex; align-items: center; gap: 5px; }
        .form-group { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; align-items: center; gap: 10px; }
        h1, h2 { color: #00d1b2; }
        .note { font-size: 0.9em; color: #aaa; }

        .response-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: var(--response-height);
            background-color: #1e1e1e;
            border-top: 2px solid #00d1b2;
            padding: 10px 20px;
            box-sizing: border-box;
            z-index: 100;
            display: flex;
            flex-direction: column;
        }
        .response-container .title-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .response-container h2 { margin: 0 0 10px 0; }
        .response-container textarea { flex-grow: 1; width: 100%; background-color: #1a1a1a; color: #f0f0f0; border: 1px solid #444; font-family: monospace; box-sizing: border-box; }
    </style>
</head>
<body>
    <div class="container">
        <div class="scrollable-content">
            <h1>🎯 API Testbed</h1>
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
                    <input type="text" name="playerName" placeholder="Player Name" value="Alice" required>
                    <button type="submit" name="action" value="remove_player">Remove Player</button>
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
                    <p class="note">To test `saveMatchStats`, start a game, then submit a score that equals the player's remaining total and check the "Is Checkout" box. Repeat until a player wins the required number of legs.</p>
                </div>
                <form>
                    <button type="submit" name="action" value="undo">Undo Last Score</button>
                </form>
                <form>
                    <button type="submit" name="action" value="start_new_leg">Start Next Leg</button>
                </form>
            </fieldset>

            <fieldset>
                <legend>Stats Actions</legend>
                <form>
                    <button type="submit" name="action" value="get_players">Get All Players</button>
                </form>
                <form>
                    <button type="submit" name="action" value="get_matches">Get All Matches</button>
                </form>
                <form>
                    <input type="text" name="player1" placeholder="Player 1" value="Player 1" required>
                    <input type="text" name="player2" placeholder="Player 2" value="Player 2" required>
                    <button type="submit" name="action" value="get_h2h_stats">Get H2H Stats</button>
                </form>
            </fieldset>

            <fieldset>
                <legend>Session Management</legend>
                <form>
                    <button type="submit" name="action" value="reset">Reset Session</button>
                </form>
            </fieldset>
        </div>
    </div>

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

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const responseTextArea = document.getElementById('responseTextArea');
            const logTextArea = document.getElementById('logTextArea');
            const clearResponseBtn = document.getElementById('clearResponseBtn');
            const clearLogBtn = document.getElementById('clearLogBtn');
            const scrollableContent = document.querySelector('.scrollable-content');

            clearResponseBtn.addEventListener('click', () => {
                responseTextArea.value = '';
            });

            clearLogBtn.addEventListener('click', () => {
                logTextArea.value = '';
            });

            scrollableContent.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const form = e.target;
                const submitter = e.submitter;
                const action = submitter.value;

                // Clear previous results and log the new action
                responseTextArea.value = '';
                logTextArea.value = `Making request for action: ${action}...\n`;

                let url = 'index.php';
                const options = {
                    method: 'POST',
                };

                const getActions = ['get_setup_players', 'get_players', 'get_matches', 'reset'];
                const getWithParamsActions = ['get_h2h_stats'];

                if (getActions.includes(action)) {
                    options.method = 'GET';
                    url += `?action=${action}`;
                } else if (getWithParamsActions.includes(action)) {
                    options.method = 'GET';
                    const params = new URLSearchParams(new FormData(form));
                    url += `?action=${action}&${params.toString()}`;
                } else {
                    // POST actions
                    const formData = new FormData(form);
                    formData.append('action', action);

                    // Special case for start_game to pre-load players
                    if (action === 'start_game') {
                        logTextArea.value += 'Pre-loading players for start_game test...\n';
                        const p1Data = new FormData();
                        p1Data.append('action', 'add_player');
                        p1Data.append('playerName', 'Player 1');
                        await fetch(url, { method: 'POST', body: p1Data });

                        const p2Data = new FormData();
                        p2Data.append('action', 'add_player');
                        p2Data.append('playerName', 'Player 2');
                        await fetch(url, { method: 'POST', body: p2Data });
                        logTextArea.value += 'Players loaded. Starting game...\n';
                    }

                    options.body = formData;
                }

                try {
                    const response = await fetch(url, options);
                    const rawText = await response.text();
                    logTextArea.value += `Received response from server (status: ${response.status}).\n`;
                    
                    responseTextArea.value = rawText;

                    if (action === 'reset') {
                        logTextArea.value += "NOTE: Session destroyed. Subsequent requests will be in a new session.\n";
                    }

                } catch (error) {
                    logTextArea.value += `Network or fetch error:\n${error.toString()}`;
                }
            });
        });
    </script>
</body>
</html>