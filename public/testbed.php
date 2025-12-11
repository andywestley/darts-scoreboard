<?php
require_once __DIR__ . '/../bootstrap.php';

$response = '';

function make_request($url, $post_data = null) {
    $ch = curl_init();
    
    // Preserve the session across cURL requests
    $cookies = [];
    foreach ($_COOKIE as $key => $value) {
        $cookies[] = "$key=$value";
    }
    
    curl_setopt($ch, CURLOPT_COOKIE, implode(';', $cookies));
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HEADER, 0);

    if ($post_data) {
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
    }

    $output = curl_exec($ch);
    curl_close($ch);
    return $output;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $api_url = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']) . '/../api.php';
    $action = $_POST['action'] ?? '';

    switch ($action) {
        case 'get_setup_players':
        case 'get_players':
        case 'get_matches':
            $response = make_request($api_url . '?action=' . $action);
            break;
        case 'add_player':
            $response = make_request($api_url, ['action' => 'add_player', 'playerName' => $_POST['playerName']]);
            break;
        case 'remove_player':
            $response = make_request($api_url, ['action' => 'remove_player', 'playerName' => $_POST['playerName']]);
            break;
        case 'start_game':
            // First, add some players to the session for the game to start
            make_request($api_url, ['action' => 'add_player', 'playerName' => 'Player 1']);
            make_request($api_url, ['action' => 'add_player', 'playerName' => 'Player 2']);
            // Then, start the game
            $response = make_request($api_url, ['action' => 'start_game', 'gameType' => 501, 'matchLegs' => 3]);
            break;
        case 'submit_score':
            $response = make_request($api_url, ['action' => 'submit_score', 'score' => $_POST['score']]);
            break;
        case 'undo':
            $response = make_request($api_url, ['action' => 'undo']);
            break;
        case 'get_h2h_stats':
            $response = make_request($api_url . '?action=get_h2h_stats&player1=' . urlencode($_POST['player1']) . '&player2=' . urlencode($_POST['player2']));
            break;
        case 'reset':
            $response = make_request($api_url . '?action=reset');
            $response .= "\n\nNOTE: Session destroyed. Response may be a redirect header.";
            break;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Testbed</title>
    <style>
        body { font-family: sans-serif; background-color: #2c2c2c; color: #f0f0f0; padding: 20px; }
        .container { max-width: 900px; margin: auto; }
        fieldset { border: 1px solid #444; margin-bottom: 20px; padding: 15px; }
        legend { font-weight: bold; color: #00d1b2; padding: 0 5px; }
        form { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        button { background-color: #00d1b2; color: #1a1a1a; border: none; padding: 8px 12px; cursor: pointer; }
        input[type="text"], input[type="number"] { padding: 8px; }
        textarea { width: 100%; height: 150px; background-color: #1a1a1a; color: #f0f0f0; border: 1px solid #444; font-family: monospace; }
        h1, h2 { color: #00d1b2; }
        .note { font-size: 0.9em; color: #aaa; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 API Testbed</h1>
        <p>Use this page to test API actions independently. The raw server response will appear in the text area below.</p>

        <fieldset>
            <legend>Setup Actions</legend>
            <form method="POST">
                <button type="submit" name="action" value="get_setup_players">Get Setup Players</button>
            </form>
            <form method="POST">
                <input type="text" name="playerName" placeholder="Player Name" value="Alice" required>
                <button type="submit" name="action" value="add_player">Add Player</button>
            </form>
            <form method="POST">
                <input type="text" name="playerName" placeholder="Player Name" value="Alice" required>
                <button type="submit" name="action" value="remove_player">Remove Player</button>
            </form>
            <form method="POST">
                <button type="submit" name="action" value="start_game">Start Game</button>
                <span class="note">(Adds 'Player 1' & 'Player 2' then starts a 501/3 game)</span>
            </form>
        </fieldset>

        <fieldset>
            <legend>Game Actions</legend>
            <p class="note">A game must be started for these to work.</p>
            <form method="POST">
                <input type="number" name="score" placeholder="Score" value="100" required>
                <button type="submit" name="action" value="submit_score">Submit Score</button>
            </form>
            <form method="POST">
                <button type="submit" name="action" value="undo">Undo Last Score</button>
            </form>
        </fieldset>

        <fieldset>
            <legend>Stats Actions</legend>
            <form method="POST">
                <button type="submit" name="action" value="get_players">Get All Players</button>
            </form>
            <form method="POST">
                <button type="submit" name="action" value="get_matches">Get All Matches</button>
            </form>
            <form method="POST">
                <input type="text" name="player1" placeholder="Player 1" value="Player 1" required>
                <input type="text" name="player2" placeholder="Player 2" value="Player 2" required>
                <button type="submit" name="action" value="get_h2h_stats">Get H2H Stats</button>
            </form>
        </fieldset>

        <fieldset>
            <legend>Session Management</legend>
            <form method="POST">
                <button type="submit" name="action" value="reset">Reset Session</button>
            </form>
        </fieldset>

        <h2>API Response</h2>
        <textarea readonly><?php echo htmlspecialchars($response); ?></textarea>
    </div>
</body>
</html>
```

### How to Use the Testbed

1.  Save the new file as `testbed.php` in the `c:\Users\Andrew\Documents\github\darts-scoreboard\public\` directory.
2.  Upload it to your server.
3.  Navigate to `https://dartboard.andrewwestley.co.uk/testbed.php` in your browser.

You will see a series of buttons and input fields. When you click a "Test" button, the page will perform the following actions:

*   It makes a server-side cURL request to your `api.php` endpoint, simulating what your JavaScript would do.
*   It captures the **exact raw output** from the server.
*   It displays that raw output in the "API Response" textarea at the bottom of the page.

If you test the "Add Player" action and still see the `SyntaxError`, the textarea will now show you the exact PHP notice or error that is being generated, which will allow us to pinpoint and fix it definitively.

<!--
[PROMPT_SUGGESTION]The testbed shows a "Cannot redeclare class" error. Can you help me fix it?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]The testbed helped me fix the API. Can you now add the styles for the game screen?[/PROMPT_SUGGESTION]
-->