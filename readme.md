# 🎯 Darts Scoreboard Application

A clean, interactive digital scoreboard for tracking X01 games (e.g., 301, 501) with automatic score calculation, leg tracking, and checkout validation.

![Status](https://img.shields.io/badge/status-active-success) ![License](https://img.shields.io/badge/license-MIT-blue)

## Table of Contents
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
* **Turn Management:** Automatically switches the active player and tracks legs won.
* **Validation:** Prevents impossible scores (e.g., inputting > 180 or invalid checkout numbers).

---
 
## 🏗 Architecture & Design Decisions

### User Interface (UI) Strategy
* **Large Hit Areas:** The UI was designed with a "Mobile-First" approach. Darts players are usually standing and tapping a screen (tablet or phone) while holding darts. Small buttons would lead to frustration and misclicks.
* **High Contrast Visibility:** We utilized high-contrast colors (Green for Go/Current Player, Red for Stop/Waiting) so the score is readable from the oche (the throw line), which is 7ft 9.25in away.

### Game Logic Implementation
* **"Bust" Mechanics:** Instead of simple subtraction, the system checks the result *before* committing the score. If `CurrentScore - Input < 0` or `CurrentScore - Input == 1`, the system triggers a "Bust" state, reverting the score to the start of the turn, adhering to official PDC rules.
* **Double-Out Requirement:** The game logic enforces that a player's final dart must be a double to win the leg.

### State Management
* **Server-Side State:** The game state (Player 1 Score, Player 2 Score, current turn, etc.) is managed authoritatively on the server using PHP sessions. The frontend sends user actions to the backend, which processes the logic, updates the session state, and returns the new state to the client. This ensures a single source of truth and prevents client-side tampering.

---
 
## 🛠 Technical Implementation

### Tech Stack
*   **Backend:** PHP 8+ for API logic, session management, and data persistence.
*   **Frontend:** Vanilla JavaScript (ES6+) for dynamic UI updates and API communication.
*   **Styling:** CSS3 with BEM naming conventions and CSS Variables for theming.
*   **Data Storage:** Flat-file JSON (`/data/*.json`) for storing player and match history.

### Key Challenges & Solutions
> **Challenge:** Handling Invalid Inputs.
> 
> **Solution:** All score submissions are validated on the PHP backend. The logic checks for bust conditions (score < 0 or score = 1) and enforces the double-out rule before committing the state change to the session.

### Project Structure
The project follows a modern PHP application structure with a public document root for enhanced security:
*   `public/`: The web server's document root.
    *   `index.php`: The main entry point that renders the HTML shell.
    *   `js/app.js`: Handles all client-side interactivity and API calls.
    *   `css/style.css`: All BEM-structured styles for the application.
*   `src/`: Contains all backend PHP classes.
    *   `Controller/`: Classes that handle specific API actions (e.g., `GameController`, `StatsController`).
    *   `Data/`: A `Storage` class that abstracts file system interactions.
*   `api.php`: A simple front-controller that routes API requests to the appropriate controller methods.
*   `data/`: A private directory for storing JSON data files.

---
 
## 🚀 Future Enhancements

### 1. Alternative Game Modes
*   **Feature:** Implement other popular darts games, such as **Cricket**, **Around the World**, or **Shanghai**.
*   **Benefit:** This would broaden the application's appeal to a wider range of players and add variety.

### 2. Enhanced Match History
*   **Feature:** Add search and filter functionality to the Match History screen.
*   **Benefit:** Allow users to easily find past matches by player name or date, which would be especially useful as the history grows.


---
 
## 🏁 Getting Started

This project requires a local web server with PHP.

1.  Clone the repository to a directory on your machine.
2.  Configure a web server (like Apache or Nginx) to use the `public/` directory as its document root.
3.  Alternatively, navigate to the project's root directory in your terminal and run PHP's built-in server: `php -S localhost:8000 -t public`
4.  Open `http://localhost:8000` in your web browser.

The scoreboard will be ready to use immediately.