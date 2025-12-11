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

---

## 🛠 Technical Implementation

### Tech Stack
*   **Structure:** HTML5 (`index.html`)
*   **Styling:** CSS3 with Flexbox/Grid for responsive layout (`style.css`)
*   **Logic:** Vanilla JavaScript (ES6+) for game state management and DOM manipulation (`app.js`)

### Key Challenges & Solutions
> **Challenge:** Handling Invalid Inputs.
>
> **Solution:** Users might accidentally type "500" or a score that isn't mathematically possible with three darts. We implemented an `isValidScore()` helper function that validates the input against maximum turn scores (180) and standard darts math rules before processing.

### Project Structure
The project is now organized with a clear separation of concerns into three main files:
*   `index.html`: The core HTML structure of the application.
*   `style.css`: Contains all the styles for the UI, including colors, layout, and responsiveness.
*   `app.js`: Holds all the game logic, state management, and event handling.

---

## 🚀 Future Enhancements

There are several features identified to take this project from a simple calculator to a full match companion:

### 1. Checkout Assistant (High Priority)
* **Feature:** When a player reaches a checkout range (e.g., 170 or below), display the optimal dart combination.
* *Example:* If score is 121, display: `T20 - T11 - D14`.

### 2. "Undo" Functionality
* **Feature:** A history stack to allow the last entry to be removed.
* **Why:** Mis-tapping a score is common on touchscreens. Currently, a mistake might require a page refresh.

### 3. Match Statistics

---

## 🏁 Getting Started

Since this is a pure frontend project, there's no complex setup required.

1.  Clone or download the repository.
2.  Open the `index.html` file in any modern web browser (like Chrome, Firefox, or Safari).

The scoreboard will be ready to use immediately.