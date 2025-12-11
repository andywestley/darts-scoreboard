# 🎯 Darts Scoreboard Application

A feature-rich, web-based scoreboard for X01 darts games (e.g., 501, 301). This application provides an intuitive interface for scoring matches, tracks player statistics, and offers helpful in-game features.

It is designed to work with an optional Python backend for persistent player stat tracking across multiple games.

![Status](https://img.shields.io/badge/status-active-success) ![License](https://img.shields.io/badge/license-MIT-blue)

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [Architecture & Design Decisions](#-architecture--design-decisions)
- [Technical Implementation](#-technical-implementation)
- [Future Enhancements](#-future-enhancements)
- [Getting Started](#-getting-started)

---

## 🔭 Project Overview

**Goal:** To replace the traditional chalkboard/whiteboard with a digital solution that handles the math, allowing players to focus on their throw.

**Key Features:**
* **X01 Game Logic:** Supports standard 501 and 301 formats.
* **Automatic Math:** Subtraction, bust detection, and remaining score calculation.
* **Turn Management:** Automatically switches active players and tracks legs/sets.
* **Validation:** Prevents impossible scores (e.g., inputting > 180 or invalid checkout numbers).

---

## 🏗 Architecture & Design Decisions

### User Interface (UI) Strategy
* **Large Hit Areas:** The UI was designed with a "Mobile-First" approach. Darts players are usually standing and tapping a screen (tablet or phone) while holding darts. Small buttons would lead to frustration and misclicks.
* **High Contrast Visibility:** We utilized high-contrast colors (Green for Go/Current Player, Red for Stop/Waiting) so the score is readable from the oche (the throw line), which is 7ft 9.25in away.

### Game Logic Implementation
* **"Bust" Mechanics:** Instead of simple subtraction, the system checks the result *before* committing the score. If `CurrentScore - Input < 0` or `CurrentScore - Input == 1`, the system triggers a "Bust" state, reverting the score to the start of the turn, adhering to official PDC rules.
* **Double-Out Requirement:** The game logic enforces that the final dart must be a double to reach exactly zero.

### State Management
* **Centralized Game State:** We hold the game state (P1 Score, P2 Score, Legs, Current Turn) in a single object/source of truth. This prevents synchronization issues where the UI might show it's Player 1's turn while the internal logic thinks it's Player 2's.
* **Persistent Player Statistics:** Player statistics (e.g., win rates, overall averages) are managed and stored persistently by an optional Python backend server, allowing stats to be tracked across multiple game sessions.
 
---

## 🛠 Technical Implementation

### Tech Stack
*   **Structure:** HTML5 (`index.html`)
*   **Styling:** CSS3 with Flexbox/Grid for responsive layout (`style.css`)
*   **Logic:** Vanilla JavaScript (ES6+) for game state management and DOM manipulation (`app.js`)
*   **Backend (Optional):** Python (Flask) for persistent player data storage and retrieval (`server.py`).

### Key Challenges & Solutions
> **Challenge:** Handling Invalid Inputs.
>
> **Solution:** The game logic rigorously checks for "bust" conditions (score < 0 or = 1) and ensures that a winning throw must be a double. Additionally, the system prevents scores greater than 180 (the maximum possible score with three darts) from being entered.

### Project Structure
The project is now organized with a clear separation of concerns into three main files:
*   `index.html`: The core HTML structure of the application.
*   `style.css`: Contains all the styles for the UI, including colors, layout, and responsiveness.
*   `app.js`: Holds all the game logic, state management, and event handling.
*   `server.py` (Optional): The Flask backend for managing persistent player statistics.

---

## 🚀 Getting Started

This project consists of a frontend (this repository) and an optional backend for stat persistence.

### Frontend

1.  Clone the repository.
2.  Open the `index.html` file in your web browser.

That's it! You can start playing immediately.

### Backend (Optional)

For persistent stat tracking, you need to run the corresponding Python server.

1.  Ensure you have Python installed.
2.  Install Flask and Flask-CORS: `pip install Flask Flask-Cors`.
3.  Navigate to the directory containing `server.py` in your terminal.
4.  Run the server: `python server.py`.
5.  In `app.js`, ensure the `API_BASE_URL` and `API_KEY` match the values in your `server.py`.
6.  Uncomment the `loadRegisteredPlayers()` call in the `DOMContentLoaded` event listener in `app.js` to enable loading of registered players.

## 🛠️ How to Use

1.  **Setup Screen**:
    *   Enter a player's name and click "Add Player" or press Enter.
    *   Repeat for all players.
    *   Choose the game type (501, 301, etc.).
    *   Click "Start Game".
2.  **Game Screen**:
    *   The current player is highlighted.
    *   Use the number pad and multiplier buttons (Double/Treble) to enter the score for each dart. The score is submitted automatically when you press a number.
    *   Use the "Undo" button to correct a mistake.
    *   After 3 darts, the turn automatically passes to the next player.
3.  **Winning a Leg**:
    *   When a player wins a leg, a confirmation screen appears.
    *   Click "Start Next Leg" to reset scores and continue the match.
4.  **Viewing Stats**:
    *   Click the "View Player Stats" button on the setup screen.
    *   Select a registered player from the list to see their detailed statistics.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---

*This README was generated based on the application state as of December 2025.*