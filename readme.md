# 🎯 Darts Scoreboard Application

> A clean, interactive digital scoreboard for tracking X01 games (301, 501) with automatic score calculation, leg tracking, and checkout validation.

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
* **Turn Management:** Automatically switches active players and tracks legs won.
* **Validation:** Prevents impossible scores (e.g., inputting > 180 or invalid checkout numbers).
* **Stateless Backend:** The PHP backend is fully stateless, processing game state sent from the client and returning the new state.

---

## 🏗 Architecture & Design Decisions

### User Interface (UI) Strategy
* **Large Hit Areas:** The UI was designed with a "Mobile-First" approach. Darts players are usually standing and tapping a screen (tablet or phone) while holding darts. Small buttons would lead to frustration and misclicks.
* **High Contrast Visibility:** We utilized high-contrast colors (Green for Go/Current Player, Red for Stop/Waiting) so the score is readable from the oche (the throw line), which is 7ft 9.25in away.

### Game Logic Implementation
* **"Bust" Mechanics:** The client-side JavaScript determines if a throw is a "Bust" (e.g., score goes below zero or to exactly one). It then sends a flag (`isBust`) to the backend, which records the bust and advances the turn without changing the score.
* **Double-Out Requirement:** The client validates that a checkout is valid (ends on a double to reach zero) and sends an `isCheckout` flag to the backend. The backend trusts this flag to process a leg win.

### State Management
* **Stateless API:** The application uses a stateless API model. The entire game state is held by the client (in JavaScript). When an action occurs (like a score being entered), the client sends the *entire* game state object to the PHP backend. The backend processes the action, calculates the *new* game state, and returns it in the API response. The client then replaces its old state with the new one. This eliminates the need for server-side sessions for gameplay and ensures the client is always the single source of truth.

---

## 🛠 Technical Implementation

### Tech Stack
*   **Backend:** PHP 8+ for API logic, session management, and data persistence.
*   **Frontend:** Vanilla JavaScript (ES6+) for UI rendering, state management, and API communication.
*   **Styling:** CSS3 with BEM naming conventions and CSS Variables for theming.
*   **Data Storage:** Flat-file JSON (`/data/*.json`) for storing player and match history.
*   **Authentication:** Stateless JWT for securing API endpoints.

### Dependency Management
This project intentionally avoids Composer. The `php-jwt` library and all internal classes are loaded manually via `require_once` statements in `bootstrap.php`, keeping the setup simple and self-contained.

### Key Challenges & Solutions
> **Challenge:** Ensuring game logic is applied correctly in a stateless environment.
>
> **Solution:** All core game logic is encapsulated in a pure `GameService.php` class, which is decoupled from HTTP requests. Controllers (`GameController.php`) are thin layers that receive the state from the client, pass it to the `GameService`, and return the result. This makes the logic predictable and easy to test. Client-side validation provides immediate user feedback, while the backend performs the authoritative state transition.

### Project Structure
The project follows a modern PHP application structure with a public document root for enhanced security:
*   `public/`: The web server's document root.
    *   `index.php`: The main entry point that renders the HTML shell.
    *   `js/app.js`: Handles all client-side interactivity and API calls.
    *   `css/style.css`: All BEM-structured styles for the application.
*   `src/`: Contains all backend PHP classes.
    *   `Controller/`: Classes that handle API routing and HTTP requests/responses.
    *   `Data/`: A `Storage` class that abstracts file system interactions.
    *   `Service/`: Contains the core business logic (`GameService.php`).
*   `api.php`: A simple front-controller that routes API requests to the appropriate controller methods based on an `action` parameter.
*   `data/`: A private directory for storing JSON data files, inaccessible from the web.

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