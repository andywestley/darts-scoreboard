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
     * @param array $match The current match state
     * @param array $dartScores An array of scores for the darts thrown in the turn (e.g., [60, 20, 5]).
     * @return array The updated match state.
     */
    public function applyScore(array $match, array $dartScores): array
    {
        $this->logger->info('Applying turn score', ['darts' => $dartScores]);

        $playerIndex = $match['currentPlayerIndex'];
        $player = &$match['players'][$playerIndex]; // Use reference to modify directly
        $scoreAtStartOfTurn = $player['score'];
        $turnTotal = 0;
        $isBust = false;
        $lastDart = null;

        foreach ($dartScores as $dart) {
            $lastDart = $dart; // Keep track of the last dart thrown
            $player['score'] -= $dart['score'];
            $turnTotal += $dart['score'];
            // Check for bust condition after each dart
            if ($player['score'] < 2) {
                $isBust = true;
                break; // Turn is over
            }
        }

        if ($isBust) {
            $this->logger->info('Player busted.', ['player' => $player['name'], 'score_reverted_to' => $scoreAtStartOfTurn]);
            $player['score'] = $scoreAtStartOfTurn; // Revert score
            // Add the score from the start of the turn to their history to show no change
            $player['scores'][] = $scoreAtStartOfTurn;
        } else {
            // Add the new score to the player's personal score history
            $player['scores'][] = $player['score'];

            // Check for a valid checkout: score must be 0 AND last dart must be a double or bullseye.
            if ($player['score'] === 0 && $lastDart !== null) {
                $isDouble = $lastDart['multiplier'] === 2;
                $isBullseye = $lastDart['base'] === 50; // Bullseye counts as a double

                if (!$isDouble && !$isBullseye) {
                    $isBust = true; // Invalid checkout is a bust
                }
            }

            if ($isBust) {
                // This block is now reachable if the checkout was invalid.
                $this->logger->info('Player busted (invalid checkout).', ['player' => $player['name'], 'score_reverted_to' => $scoreAtStartOfTurn]);
                $player['score'] = $scoreAtStartOfTurn;
                $player['scores'][count($player['scores']) - 1] = $scoreAtStartOfTurn; // Correct the last history entry
            } else if ($player['score'] === 0) {
                $this->logger->info('Player has checked out with a valid double, processing leg win.');
                return $this->processLegWin($match, $playerIndex);
            }
        }

        // Record the turn in the main match history
        $match['history'][] = ['playerIndex' => $playerIndex, 'scoreThrown' => $turnTotal, 'isBust' => $isBust];
        $player['dartsThrown'] += count($dartScores);

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