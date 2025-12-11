from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import json
import os

# --- CONFIGURATION ---
app = Flask(__name__)
CORS(app)  # Allow Cross-Origin requests for local development

# Load the secret key from an environment variable for better security.
# Fallback to a default key for easy local development.
SECRET_API_KEY = os.environ.get("DARTBOARD_API_KEY", "your-super-secret-key-dev")

# Define a dedicated directory for data files.
DATA_DIR = 'data'
PLAYERS_DATA_FILE = os.path.join(DATA_DIR, 'players.json')
MATCHES_DATA_FILE = os.path.join(DATA_DIR, 'matches.json')

# --- DATA HELPER FUNCTIONS ---

def get_player_data():
    """Loads player data from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return {}  # Return empty dict if file doesn't exist
def ensure_data_dir():
    """Ensures the data directory exists."""
    os.makedirs(DATA_DIR, exist_ok=True)
def get_data(file_path):
    """Generic function to load data from a JSON file."""
    if not os.path.exists(file_path):
        return [] if 'matches' in file_path else {}
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return [] if 'matches' in file_path else {}

def save_player_data(data): # This function remains for player stats
    """Saves player data to the JSON file."""
    with open(PLAYERS_DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def append_match_data(match_record):
    """Appends a new match record to the matches JSON file."""
    all_matches = get_data(MATCHES_DATA_FILE)
    all_matches.append(match_record)
    with open(MATCHES_DATA_FILE, 'w') as f:
        json.dump(all_matches, f, indent=4)

# --- API ENDPOINTS ---

@app.route('/api/ping', methods=['GET'])
def ping():
    """A simple health check endpoint to see if the server is running."""
    return jsonify({"status": "ok"})


@app.route('/api/players', methods=['GET'])
def get_players():
    """
    Endpoint to get all registered players.
    This is a public endpoint and requires no authentication.
    """
    players_data = get_data(PLAYERS_DATA_FILE)
    # Convert the dictionary of players into a list for the client
    players_list = list(players_data.values())
    return jsonify(players_list)

@app.route('/api/matches', methods=['GET'])
def get_matches():
    """
    Endpoint to get all completed match records.
    This is a public endpoint.
    """
    matches_data = get_data(MATCHES_DATA_FILE)
    # Sort matches by timestamp, newest first, to show recent matches at the top
    matches_data.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return jsonify(matches_data)


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

    all_players = get_data(PLAYERS_DATA_FILE)

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

@app.route('/api/matches', methods=['POST'])
def save_match():
    """
    Endpoint to save a completed match record.
    This is a protected endpoint.
    """
    # --- Authentication Check ---
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description="Authorization header is missing or invalid.")
    
    token = auth_header.split(' ')[1]
    if token != SECRET_API_KEY:
        abort(403, description="Invalid API key.")

    # --- Save Logic ---
    match_record = request.json
    if not match_record or 'winner' not in match_record:
        abort(400, description="Invalid match record data.")

    append_match_data(match_record)
    
    return jsonify({"status": "success", "message": "Match record saved."})

# --- MAIN EXECUTION ---

if __name__ == '__main__':
    """
    To run the server:
    1. Make sure you have Flask installed: pip install Flask Flask-Cors
    2. Run this file: python server.py
    The server will be available at http://127.0.0.1:5001
    """
    ensure_data_dir()
    print("--- Darts Scoreboard Server ---")
    print(f"Secret Key: '{SECRET_API_KEY}'")
    print("Starting server on http://127.0.0.1:5001")
    app.run(port=5001, debug=True)