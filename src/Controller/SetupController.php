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

        $players = $_SESSION['setup_players'] ?? [];
        if (in_array($playerName, $players)) {
            $this->jsonResponse(['success' => false, 'message' => 'Player already added.']);
            return;
        }

        $players[] = $playerName;
        $_SESSION['setup_players'] = $players;

        // Also ensure the player exists in persistent storage for future stat tracking.
        if ($this->storage->getPlayerByName($playerName) === null) {
            $this->storage->addPlayer($playerName);
        }

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

    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}