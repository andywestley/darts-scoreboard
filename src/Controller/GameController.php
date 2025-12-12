<?php

namespace Darts\Controller;

use Darts\Data\Storage;

class GameController
{
    private Storage $storage;

    public function __construct(Storage $storage)
    {
        $this->storage = $storage;
    }

    public function submitScore(): void
    {
        $score = (int)($_POST['score'] ?? 0);
        $isBust = (bool)($_POST['isBust'] ?? false);
        $isCheckout = (bool)($_POST['isCheckout'] ?? false);
        $dartsThrown = (int)($_POST['dartsThrown'] ?? 3);
        
        // The entire match state is now sent from the client.
        $match = json_decode($_POST['matchState'] ?? 'null', true);

        if ($match === null) {
            $this->jsonResponse(['success' => false, 'message' => 'No match state provided.']);
            return;
        }

        $currentPlayerIndex = $match['currentPlayerIndex'];
        $player = &$match['players'][$currentPlayerIndex];

        // Store current state for undo (this remains a good pattern)
        $match['history'][] = [
            'playerIndex' => $currentPlayerIndex,
            'previousScore' => $player['score'],
            'previousDartsThrown' => $player['dartsThrown'],
            'previousScores' => $player['scores'],
            'previousIsOver' => $match['isOver'],
            'previousWinner' => $match['winner'],
        ];

        $player['dartsThrown'] += $dartsThrown;
        $player['scores'][] = $score; // Store individual turn scores for average calculation

        if ($isBust) {
            // Score remains unchanged for a bust
            // No further action needed for bust, just move to next player
        } else {
            $player['score'] -= $score;
        }

        if ($player['score'] === 0 && $isCheckout) {
            // Player won the leg
            $player['legsWon']++;

            // Record leg history
            $match['legHistory'][] = [
                'leg' => $match['currentLeg'],
                'winner' => $player['name'],
                'scores' => array_map(fn($p) => ['name' => $p['name'], 'score' => $p['score'], 'dartsThrown' => $p['dartsThrown']], $match['players'])
            ];

            // Check if match is over
            if ($player['legsWon'] >= $match['matchLegs']) {
                $match['isOver'] = true;
                $match['winner'] = $player['name'];
                $this->saveMatchStats($match);
                $_SESSION['screen'] = 'summary';
            } else {
                // Prepare for next leg
                // Reset scores for all players for the new leg
                foreach ($match['players'] as &$p) {
                    $p['score'] = $match['gameType'];
                    $p['dartsThrown'] = 0;
                    $p['scores'] = [];
                }
                unset($p); // Break the reference
                $match['currentLeg']++;
            }
        }

        // Move to next player if leg is not over or if it's a bust/normal score
        if (!$match['isOver'] && !($player['score'] === 0 && $isCheckout)) {
            $match['currentPlayerIndex'] = ($match['currentPlayerIndex'] + 1) % count($match['players']);
        }

        // In a stateless model, we save the new state back to the session
        // so the page works on refresh, but the primary flow is stateless.
        $_SESSION['match'] = $match;
        $this->jsonResponse(['success' => true, 'match' => $match]);
    }

    public function startNewLeg(): void
    {
        $match = json_decode($_POST['matchState'] ?? 'null', true);

        if ($match === null || $match['isOver']) {
            $this->jsonResponse(['success' => false, 'message' => 'No active match provided or match is already over.']);
            return;
        }

        // Reset scores for all players for the new leg
        foreach ($match['players'] as &$p) {
            $p['score'] = $match['gameType'];
            $p['dartsThrown'] = 0;
            $p['scores'] = [];
        }
        unset($p); // Break the reference

        $match['currentLeg']++;
        $match['currentPlayerIndex'] = 0; // Start new leg with first player

        $_SESSION['match'] = $match; // Save for refresh resiliency
        $this->jsonResponse(['success' => true, 'match' => $match]);
    }

    public function undo(): void
    {
        $match = json_decode($_POST['matchState'] ?? 'null', true);

        if ($match === null || empty($match['history'])) {
            $this->jsonResponse(['success' => false, 'message' => 'No match state provided or no actions to undo.']);
            return;
        }

        $lastAction = array_pop($match['history']);

        $playerIndex = $lastAction['playerIndex'];
        $player = &$match['players'][$playerIndex];

        $player['score'] = $lastAction['previousScore'];
        $player['dartsThrown'] = $lastAction['previousDartsThrown'];
        $player['scores'] = $lastAction['previousScores'];

        $match['isOver'] = $lastAction['previousIsOver'];
        $match['winner'] = $lastAction['previousWinner'];

        // If the undo brought us back from a leg win, we need to revert leg count and current player
        // This logic can be complex depending on how leg wins are handled in history.
        // For simplicity, if the current player index changed, revert it.
        // A more robust undo would store the full match state for each turn.
        if ($match['currentPlayerIndex'] !== $playerIndex) {
            $match['currentPlayerIndex'] = $playerIndex;
        }

        $_SESSION['match'] = $match; // Save for refresh resiliency
        $this->jsonResponse(['success' => true, 'match' => $match]);
    }

    private function saveMatchStats(array $match): void
    {
        $matchSummary = [
            'timestamp' => date('c'),
            'gameType' => $match['gameType'],
            'matchLegs' => $match['matchLegs'],
            'winner' => $match['winner'],
            'totalLegs' => $match['currentLeg'],
            'standings' => [],
            'legDetails' => $match['legHistory'],
        ];

        foreach ($match['players'] as $player) {
            $totalScore = array_sum($player['scores']);
            $average = $player['dartsThrown'] > 0 ? round($totalScore / ($player['dartsThrown'] / 3), 2) : 0;

            $matchSummary['standings'][] = [
                'name' => $player['name'],
                'legsWon' => $player['legsWon'],
                'totalDarts' => $player['dartsThrown'],
                'totalScore' => $totalScore,
                'average' => $average,
            ];

            // Update player's lifetime stats
            $this->storage->updatePlayerStats(
                $player['name'],
                $player['legsWon'],
                $player['dartsThrown'],
                $totalScore
            );
        }

        $this->storage->saveMatch($matchSummary);
    }

    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}