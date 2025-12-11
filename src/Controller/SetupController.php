<?php

namespace Darts\Controller;

use Darts\Data\Storage;

class SetupController
{
    private Storage $storage;

    public function __construct(Storage $storage)
    {
        // The Storage dependency is now properly injected.
        $this->storage = $storage;
    }

    public function addPlayer(): void
    {
        $playerName = trim($_POST['playerName'] ?? '');
        if (empty($playerName)) {
            $this->jsonResponse(['success' => false, 'message' => 'Player name cannot be empty.']);
            return;
        }

        // First, ensure the player exists in the permanent storage for stat tracking.
        // This should happen regardless of the current game session.
        if ($this->storage->getPlayerByName($playerName) === null) {
            $this->storage->addPlayer($playerName);
        }

        // Next, handle the logic for the current game session.
        $players = $_SESSION['setup_players'] ?? [];
        if (in_array($playerName, $players)) {
            $this->jsonResponse(['success' => false, 'message' => 'Player already added.']);
            return;
        }

        $players[] = $playerName;
        $_SESSION['setup_players'] = $players;

        $this->jsonResponse(['success' => true, 'players' => $players]);
    }

    public function removePlayer(): void
    {
        $playerName = $_POST['playerName'] ?? '';
        $players = $_SESSION['setup_players'] ?? [];

        $key = array_search($playerName, $players);
        if ($key !== false) {
            unset($players[$key]);
            $_SESSION['setup_players'] = array_values($players); // Re-index array
            $this->jsonResponse(['success' => true, 'players' => $_SESSION['setup_players']]);
            return;
        }

        $this->jsonResponse(['success' => false, 'message' => 'Player not found.']);
    }

    public function getSetupPlayers(): void
    {
        $players = $_SESSION['setup_players'] ?? [];
        $this->jsonResponse(['success' => true, 'players' => $players]);
    }

    public function startGame(): void
    {
        $gameType = $_POST['gameType'] ?? 501;
        $matchLegs = $_POST['matchLegs'] ?? 3;
        $playerNames = $_SESSION['setup_players'] ?? [];

        if (count($playerNames) < 1) {
            $this->jsonResponse(['success' => false, 'message' => 'At least one player is required to start a game.']);
            return;
        }

        // Initialize match state in session
        $_SESSION['match'] = [
            'gameType' => (int)$gameType,
            'matchLegs' => (int)$matchLegs,
            'players' => array_map(function ($name) use ($gameType) {
                return ['name' => $name, 'score' => (int)$gameType, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => []];
            }, $playerNames),
            'currentPlayerIndex' => 0,
            'currentLeg' => 1,
            'isOver' => false,
            'winner' => null,
            'history' => [], // To store turn-by-turn actions for undo
            'legHistory' => [], // To store summary of each leg
        ];
        $_SESSION['screen'] = 'game';

        $this->jsonResponse(['success' => true, 'redirect' => '/']);
    }

    public function reset(): void
    {
        // Clear the session completely
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();

        // For an API context, we should return a success message, not redirect.
        // The client-side JS can then handle the page reload.
        $this->jsonResponse(['success' => true, 'message' => 'Session has been reset.']);
    }

    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}