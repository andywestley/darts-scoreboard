<?php

namespace Darts\Controller;

use Darts\Data\Storage;
use Darts\Service\Logger;

class SetupController
{
    private Storage $storage;
    private Logger $logger;

    public function __construct(Storage $storage, Logger $logger)
    {
        // The Storage dependency is now properly injected.
        $this->storage = $storage;
        $this->logger = $logger;
    }

    public function getAnonymousToken(): void
    {
        $secretKey = 'your-super-secret-key'; // This must match the key in index.php
        $payload = [
            'iss' => $_SERVER['HTTP_HOST'], // Issuer
            'aud' => $_SERVER['HTTP_HOST'], // Audience
            'iat' => time(), // Issued at
            'exp' => time() + (60 * 60 * 24) // Expiration time (24 hours)
        ];

        $jwt = \Firebase\JWT\JWT::encode($payload, $secretKey, 'HS256');

        $this->jsonResponse([
            'success' => true,
            'token' => $jwt
        ]);
    }

    public function persistPlayer(): void
    {
        $playerName = trim($_POST['playerName'] ?? '');
        if (empty($playerName)) {
            $this->jsonResponse(['success' => false, 'message' => 'Player name cannot be empty.']); // This action now only saves to the master list
            return;
        }

        if ($this->storage->getPlayerByName($playerName) === null) {
            $this->storage->addPlayer($playerName);
            $this->logger->info('New player persisted to master list.', ['playerName' => $playerName]);
        }

        $this->jsonResponse(['success' => true]);
    }

    public function startGame(): void
    {
        $playerNames = json_decode($_POST['players'] ?? '[]', true);

        if (count($playerNames) < 1) {
            $this->jsonResponse(['success' => false, 'message' => 'At least one player is required to start a game.']);
            return;
        }

        $gameType = (int)($_POST['gameType'] ?? 501);
        // Initialize match state in session
        $match = [
            'gameType' => $gameType,
            'matchLegs' => (int)($_POST['matchLegs'] ?? 3),
            'checkoutAssistant' => ($_POST['checkoutAssistantToggle'] ?? 'true') === 'true',
            'soundEffects' => ($_POST['soundEffectsToggle'] ?? 'true') === 'true',
            'players' => array_map(function ($name) use ($gameType) { // Pass the correct variable
                return ['name' => $name, 'score' => $gameType, 'dartsThrown' => 0, 'legsWon' => 0, 'scores' => []];
            }, $playerNames),
            'currentPlayerIndex' => 0,
            'currentLeg' => 1,
            'isOver' => false,
            'winnerName' => null,
            'history' => [], // To store turn-by-turn actions for undo
            'legHistory' => [], // To store summary of each leg
            'standings' => [],
        ];

        // Log the created match object for debugging.
        $this->logger->debug('New game started.', ['match' => $match]);

        $this->jsonResponse(['success' => true, 'match' => $match]);
    }

    public function reset(): void
    {
        // In a stateless model, this action simply needs to provide a successful
        // response so the client-side 'Force Reset' button knows it can reload the page.

        $this->jsonResponse(['success' => true, 'message' => 'Session has been reset.']);
    }

    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}