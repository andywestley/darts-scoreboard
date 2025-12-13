<?php

namespace Darts\Service;

use Darts\Service\Logger;

/**
 * GameService contains the pure business logic for the darts game.
 * It is completely decoupled from HTTP requests and sessions, making it easy to unit test.
 */
class GameService
{
    private Logger $logger;

    public function __construct(Logger $logger)
    {
        $this->logger = $logger;
    }

    /**
     * Applies a player's score to the match state.
     *
     * @param array $match The current match state.
     * @param int $score The score to be submitted.
     * @param bool $isBust Whether the frontend determined this is a bust.
     * @param bool $isCheckout Whether the frontend determined this is a checkout.
     * @return array The updated match state.
     */
    public function applyScore(array $match, int $score, bool $isBust, bool $isCheckout): array
    {
        $this->logger->info('Applying score', ['score' => $score, 'isBust' => $isBust, 'isCheckout' => $isCheckout]);

        $playerIndex = $match['currentPlayerIndex'];
        $player = &$match['players'][$playerIndex]; // Use reference to modify directly

        // Record the state before the throw for history/undo purposes
        $turnState = [
            'playerIndex' => $playerIndex,
            'previousScore' => $player['score'],
            'scoreThrown' => $score,
            'isBust' => $isBust,
        ];
        $match['history'][] = $turnState;

        if ($isBust) {
            // On a bust, the score does not change.
            $player['dartsThrown'] += 3; // Assume 3 darts for a bust turn
        } else {
            $player['score'] -= $score;
            $player['dartsThrown'] += 3; // Assume 3 darts per turn for now

            if ($isCheckout && $player['score'] === 0) {
                $this->logger->info('Player has checked out, processing leg win.');
                return $this->processLegWin($match, $playerIndex);
            }
        }

        // Advance to the next player
        $match['currentPlayerIndex'] = ($playerIndex + 1) % count($match['players']);

        return $match;
    }

    /**
     * Processes a leg win, updates standings, and checks for a match win.
     *
     * @param array $match The current match state.
     * @param int $winningPlayerIndex The index of the player who won the leg.
     * @return array The updated match state.
     */
    private function processLegWin(array $match, int $winningPlayerIndex): array
    {
        $this->logger->info('Processing leg win for player index', ['playerIndex' => $winningPlayerIndex]);

        $match['players'][$winningPlayerIndex]['legsWon']++;

        // Check for match win
        if ($match['players'][$winningPlayerIndex]['legsWon'] >= $match['matchLegs']) {
            $match['isOver'] = true;
            $match['winnerName'] = $match['players'][$winningPlayerIndex]['name'];
            $match['standings'] = $this->calculateFinalStandings($match);
            $this->logger->info('Match has been won', ['winner' => $match['winnerName']]);
        }

        return $match;
    }

    /**
     * Starts the next leg of the match.
     *
     * @param array $match The current match state.
     * @return array The updated match state for the new leg.
     */
    public function startNextLeg(array $match): array
    {
        $this->logger->info('Starting next leg', ['currentLeg' => $match['currentLeg'] + 1]);

        $match['currentLeg']++;
        // Reset scores for all players
        foreach ($match['players'] as &$player) {
            $player['score'] = $match['gameType'];
            $player['dartsThrown'] = 0;
        }
        // Alternate starting player for the new leg (simple alternation)
        $match['currentPlayerIndex'] = ($match['currentLeg'] - 1) % count($match['players']);

        return $match;
    }

    /**
     * Calculates and sorts the final player standings.
     *
     * @param array $match The completed match state.
     * @return array The sorted list of players.
     */
    private function calculateFinalStandings(array $match): array
    {
        $standings = $match['players'];
        usort($standings, function ($a, $b) {
            return $b['legsWon'] <=> $a['legsWon']; // Sort descending by legs won
        });
        return $standings;
    }
}