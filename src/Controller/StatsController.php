<?php

namespace Darts\Controller;

use Darts\Data\Storage;

class StatsController
{
    private Storage $storage;

    public function __construct(Storage $storage)
    {
        $this->storage = $storage;
    }

    public function getPlayers(): void
    {
        $players = $this->storage->getPlayersData();
        $this->jsonResponse(['success' => true, 'players' => array_values((array)$players)]);
    }

    public function getMatches(): void
    {
        $matches = $this->storage->getMatches();
        usort($matches, fn($a, $b) => strtotime($b->timestamp) <=> strtotime($a->timestamp));
        $this->jsonResponse(['success' => true, 'matches' => $matches]);
    }

    public function getH2HStats(): void
    {
        $player1Name = $_GET['player1'] ?? null;
        $player2Name = $_GET['player2'] ?? null;

        if (!$player1Name || !$player2Name) {
            $this->jsonResponse(['success' => false, 'message' => 'Two player names are required for H2H stats.']);
            return;
        }

        $allMatches = $this->storage->getMatches();
        $h2hRecord = ['player1_wins' => 0, 'player2_wins' => 0, 'total_matches' => 0];

        foreach ($allMatches as $match) {
            $playerNamesInMatch = array_map(fn($p) => $p['name'], $match['standings']);

            if (in_array($player1Name, $playerNamesInMatch) && in_array($player2Name, $playerNamesInMatch)) {
                $h2hRecord['total_matches']++;
                if ($match->winner === $player1Name) {
                    $h2hRecord['player1_wins']++;
                } elseif ($match->winner === $player2Name) {
                    $h2hRecord['player2_wins']++;
                }
            }
        }

        $this->jsonResponse([
            'success' => true,
            'data' => $h2hRecord
        ]);
    }

    private function jsonResponse(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}