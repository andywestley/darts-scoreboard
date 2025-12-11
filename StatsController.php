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
        $this->jsonResponse(array_values((array)$players));
    }

    public function getMatches(): void
    {
        $matches = $this->storage->getData($this->storage->getMatchesDataFile()); // Use a getter for the path
        usort($matches, fn($a, $b) => strtotime($b->timestamp) <=> strtotime($a->timestamp));
        $this->jsonResponse($matches);
    }

    private function jsonResponse(array $data): void
    {
        echo json_encode($data);
    }
}