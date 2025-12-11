from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import json
import os

# --- CONFIGURATION ---
app = Flask(__name__)
CORS(app)  # Allow Cross-Origin requests for local development

# IMPORTANT: This is your secret key. The client must send this to save data.
# In a real production app, this should be set as an environment variable.
SECRET_API_KEY = "your-super-secret-key"

DATA_FILE = 'players.json'

# --- DATA HELPER FUNCTIONS ---

def get_player_data():
    """Loads player data from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return {}  # Return empty dict if file doesn't exist
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {} # Return empty dict on error

def save_player_data(data):
    """Saves player data to the JSON file."""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# --- API ENDPOINTS ---

@app.route('/api/players', methods=['GET'])
def get_players():
    """
    Endpoint to get all registered players.
    This is a public endpoint and requires no authentication.
    """
    players_data = get_player_data()
    # Convert the dictionary of players into a list for the client
    players_list = list(players_data.values())
    return jsonify(players_list)

@app.route('/api/players/update', methods=['POST'])
def update_players():
    """
    Endpoint to update stats for multiple players.
    This is a protected endpoint and requires a valid bearer token.
    """
    # --- Authentication Check ---
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description="Authorization header is missing or invalid.")
    
    token = auth_header.split(' ')[1]
    if token != SECRET_API_KEY:
        abort(403, description="Invalid API key.")

    # --- Update Logic ---
    updates = request.json
    if not isinstance(updates, list):
        abort(400, description="Request body must be a list of player objects.")

    all_players = get_player_data()

    for player_update in updates:
        player_name = player_update.get('name')
        if not player_name:
            continue

        # If player is new, initialize their stats
        if player_name not in all_players:
            all_players[player_name] = {
                "name": player_name,
                "gamesPlayed": 0,
                "gamesWon": 0,
                "totalPointsScored": 0,
                "totalDartsThrown": 0,
                "averageHistory": [],
                "turnScoreFrequency": {}
            }
        
        # Update the player's stats
        # We merge the dictionaries, with the new data overwriting the old
        all_players[player_name].update(player_update)

    save_player_data(all_players)
    
    return jsonify({"status": "success", "message": f"{len(updates)} players updated."})


# --- MAIN EXECUTION ---

if __name__ == '__main__':
    """
    To run the server:
    1. Make sure you have Flask installed: pip install Flask Flask-Cors
    2. Run this file: python server.py
    The server will be available at http://127.0.0.1:5001
    """
    print("--- Darts Scoreboard Server ---")
    print(f"Secret Key: '{SECRET_API_KEY}'")
    print("Starting server on http://127.0.0.1:5001")
    app.run(port=5001, debug=True)