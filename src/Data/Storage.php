<?php

namespace Darts\Data;

use Exception;
use Darts\Service\Logger;

class Storage
{
    private const CODE_VERSION = 2;

    private string $basePath;
    private string $playersDataFile;
    private string $matchesDataFile;
    private array $dataCache = [];
    private Logger $logger;

    public function __construct(string $basePath, Logger $logger)
    {
        $this->logger = $logger;
        $this->logger->info('Storage service initialized.');

        $this->basePath = $basePath;
        $this->playersDataFile = $this->basePath . '/data/players.json';
        $this->matchesDataFile = $this->basePath . '/data/matches.json';

        $this->loadDataFile('players', $this->playersDataFile);
        $this->loadDataFile('matches', $this->matchesDataFile);
    }

    private function loadDataFile(string $key, string $filePath): void
    {
        if (!file_exists($filePath)) {
            $this->logger->info('Data file not found, creating it.', ['file' => $filePath]);
            $this->createDataFile($filePath);
            $this->dataCache[$key] = [];
            return;
        }

        $content = file_get_contents($filePath);
        $decoded = json_decode($content, true);

        // Handle legacy data format (simple array)
        if (is_array($decoded) && (!isset($decoded['version']) || !isset($decoded['data']))) {
            $this->logger->info('Legacy data format detected, preparing for migration.', ['file' => $filePath]);
            $fileVersion = 1;
            $fileData = $decoded;
        } else {
            $fileVersion = $decoded['version'] ?? 1;
            $fileData = $decoded['data'] ?? [];
        }

        if (self::CODE_VERSION === $fileVersion) {
            $this->logger->debug('Data file loaded successfully.', ['file' => $filePath, 'version' => $fileVersion]);
            $this->dataCache[$key] = $fileData;
        } elseif (self::CODE_VERSION > $fileVersion) {
            // Code is newer, backup old data and start fresh
            $backupPath = str_replace('.json', ".v{$fileVersion}.bak.json", $filePath);
            $this->logger->warning('Data file version is outdated. Backing up and creating a new file.', ['file' => $filePath, 'old_version' => $fileVersion, 'new_version' => self::CODE_VERSION, 'backup_path' => $backupPath]);
            rename($filePath, $backupPath);
            $this->createDataFile($filePath);
            $this->dataCache[$key] = [];
        } else {
            // Data is newer than code, this is an error
            $this->logger->error('Data file version is newer than application code.', ['file' => $filePath, 'file_version' => $fileVersion, 'code_version' => self::CODE_VERSION]);
            throw new Exception("Data file {$filePath} has version {$fileVersion}, but the application code is at version " . self::CODE_VERSION . ". Please update the application.");
        }
    }

    private function createDataFile(string $filePath): void
    {
        $dataDir = dirname($filePath);
        if (!is_dir($dataDir)) {
            // Explicitly check for writability and throw a clear exception on failure.
            $this->logger->info('Data directory does not exist, attempting to create it.', ['directory' => $dataDir]);
            if (!@mkdir($dataDir, 0777, true) && !is_dir($dataDir)) {
                throw new Exception("Failed to create data directory: {$dataDir}. Please check server permissions.");
            }
        }
        $initialData = [
            'version' => self::CODE_VERSION,
            'last_updated' => date('c'),
            'data' => []
        ];
        file_put_contents($filePath, json_encode($initialData, JSON_PRETTY_PRINT), LOCK_EX);
    }

    private function saveData(string $key, string $filePath, array $data): void
    {
        $this->dataCache[$key] = $data;
        $structuredData = [
            'version' => self::CODE_VERSION,
            'last_updated' => date('c'),
            'data' => $data
        ];
        // Use LOCK_EX for safer writes in a concurrent environment.
        file_put_contents($filePath, json_encode($structuredData, JSON_PRETTY_PRINT), LOCK_EX);
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