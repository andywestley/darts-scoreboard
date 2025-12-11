<?php

namespace Darts\Data;

use Exception;

class Storage
{
    private const CODE_VERSION = 2;

    private string $basePath;
    private string $playersDataFile;
    private string $matchesDataFile;
    private array $dataCache = [];

    public function __construct(string $basePath)
    {
        $this->basePath = $basePath;
        $this->playersDataFile = $this->basePath . '/data/players.json';
        $this->matchesDataFile = $this->basePath . '/data/matches.json';

        $this->loadDataFile('players', $this->playersDataFile);
        $this->loadDataFile('matches', $this->matchesDataFile);
    }

    private function loadDataFile(string $key, string $filePath): void
    {
        if (!file_exists($filePath)) {
            $this->createDataFile($filePath);
            $this->dataCache[$key] = [];
            return;
        }

        $content = file_get_contents($filePath);
        $decoded = json_decode($content, true);

        // Handle legacy data format (simple array)
        if (is_array($decoded) && (!isset($decoded['version']) || !isset($decoded['data']))) {
            $fileVersion = 1;
            $fileData = $decoded;
        } else {
            $fileVersion = $decoded['version'] ?? 1;
            $fileData = $decoded['data'] ?? [];
        }

        if (self::CODE_VERSION === $fileVersion) {
            $this->dataCache[$key] = $fileData;
        } elseif (self::CODE_VERSION > $fileVersion) {
            // Code is newer, backup old data and start fresh
            $backupPath = str_replace('.json', ".v{$fileVersion}.bak.json", $filePath);
            rename($filePath, $backupPath);
            $this->createDataFile($filePath);
            $this->dataCache[$key] = [];
        } else {
            // Data is newer than code, this is an error
            throw new Exception("Data file {$filePath} has version {$fileVersion}, but the application code is at version " . self::CODE_VERSION . ". Please update the application.");
        }
    }

    private function createDataFile(string $filePath): void
    {
        $dataDir = dirname($filePath);
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0777, true);
        }
        $initialData = [
            'version' => self::CODE_VERSION,
            'data' => []
        ];
        file_put_contents($filePath, json_encode($initialData, JSON_PRETTY_PRINT));
    }

    private function saveData(string $key, string $filePath, array $data): void
    {
        $this->dataCache[$key] = $data;
        $structuredData = [
            'version' => self::CODE_VERSION,
            'data' => $data
        ];
        file_put_contents($filePath, json_encode($structuredData, JSON_PRETTY_PRINT));
    }

    public function getPlayersData(): array
    {
        return $this->dataCache['players'] ?? [];
    }

    public function savePlayersData(array $players): void
    {
        $this->saveData('players', $this->playersDataFile, $players);
    }

    public function getMatches(): array
    {
        return $this->dataCache['matches'] ?? [];
    }

    public function saveMatch(array $match): void
    {
        $matches = $this->getMatches();
        $matches[] = $match;
        $this->saveData('matches', $this->matchesDataFile, $matches);
    }

    public function getPlayerByName(string $name): ?object
    {
        $players = $this->getPlayersData();
        foreach ($players as $player) {
            $player = (object) $player; // Ensure it's an object
            if ($player->name === $name) {
                return $player;
            }
        }
        return null;
    }

    public function addPlayer(string $name): object
    {
        $players = $this->getPlayersData();
        $newPlayer = ['name' => $name, 'id' => uniqid(), 'stats' => ['wins' => 0, 'legsWon' => 0, 'totalDarts' => 0, 'totalScore' => 0]];
        $players[] = $newPlayer;
        $this->savePlayersData($players);
        return (object) $newPlayer;
    }

    public function updatePlayerStats(string $playerName, int $legsWon = 0, int $totalDarts = 0, int $totalScore = 0): void
    {
        $players = $this->getPlayersData();
        foreach ($players as &$player) {
            if ($player['name'] === $playerName) {
                $player['stats']['wins'] += ($legsWon > 0 ? 1 : 0); // Assuming a win is recorded if legsWon > 0 for a match
                $player['stats']['legsWon'] += $legsWon;
                $player['stats']['totalDarts'] += $totalDarts;
                $player['stats']['totalScore'] += $totalScore;
                break;
            }
        }
        unset($player); // Unset the reference
        $this->savePlayersData($players);
    }
}