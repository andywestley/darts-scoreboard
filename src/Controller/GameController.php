<?php

namespace Darts\Controller;

use Darts\Service\GameService;
use Darts\Service\Logger;

/**
 * GameController handles the HTTP layer for game actions.
 * It delegates all business logic to the GameService.
 */
class GameController
{
    private GameService $gameService;
    private Logger $logger;

    public function __construct(GameService $gameService, Logger $logger)
    {
        $this->gameService = $gameService;
        $this->logger = $logger;
    }

    /**
     * Handles the 'game:start' action.
     */
    public function start(): void
    {
        // This logic would create the initial match state and store it.
        // For now, we assume it's handled by the App class or another service.
        // This is a placeholder to show where the action would be handled.
        // In a fully stateless model, this would create the initial state and return it.
    }

    /**
     * Handles the 'game:score' action.
     */
    public function score(): void
    {
        $matchState = json_decode($_POST['matchState'] ?? 'null', true);
        $this->logger->info('Received game:score action.', ['matchId' => $matchState['id'] ?? 'N/A']);

        if (!$matchState) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid match state provided.']);
            return;
        }

        $darts = json_decode($_POST['darts'] ?? '[]', true);
        if (empty($darts) || !is_array($darts)) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid darts array provided.']);
            return;
        }

        $newMatchState = $this->gameService->applyScore($matchState, $darts);

        $this->jsonResponse(['success' => true, 'match' => $newMatchState]);
    }

    /**
     * Handles the 'game:nextLeg' action.
     */
    public function nextLeg(): void
    {
        $matchState = json_decode($_POST['matchState'] ?? 'null', true);
        $this->logger->info('Received game:nextLeg action.', ['matchId' => $matchState['id'] ?? 'N/A']);

        if (!$matchState) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid match state provided.']);
            return;
        }

        $newMatchState = $this->gameService->startNextLeg($matchState);

        $this->jsonResponse(['success' => true, 'match' => $newMatchState]);
    }

    /**
     * Helper to send a consistent JSON response.
     *
     * @param array $data The data to encode.
     */
    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        // In a real app, you might clear output buffers here (ob_clean())
        echo json_encode($data);
    }
}