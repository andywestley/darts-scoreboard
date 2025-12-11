<?php

namespace Darts\Data;

class Storage
{
    private const DATA_DIR = __DIR__ . '/../../data';
    private const PLAYERS_DATA_FILE = self::DATA_DIR . '/players.json';
    private const MATCHES_DATA_FILE = self::DATA_DIR . '/matches.json';

    private function ensureDataDir(): void
    {
        if (!is_dir(self::DATA_DIR)) {
            mkdir(self::DATA_DIR, 0755, true);
        }
    }

    public function getData(string $file_path): array|\stdClass
    {
        if (!file_exists($file_path)) {
            return str_contains($file_path, 'matches.json') ? [] : new \stdClass();
        }
        $json = file_get_contents($file_path);
        return json_decode($json, false);
    }

    public function getPlayersData(): array|\stdClass
    {
        return $this->getData(self::PLAYERS_DATA_FILE);
    }

    public function getMatchesDataFile(): string
    {
        return $this->matchesDataFile;
    }

    public function savePlayerData(\stdClass $data): void
    {
        $this->ensureDataDir();
        file_put_contents(self::PLAYERS_DATA_FILE, json_encode($data, JSON_PRETTY_PRINT));
    }

    public function appendMatchData(array $match_record): void
    {
        $this->ensureDataDir();
        $all_matches = $this->getData(self::MATCHES_DATA_FILE);
        $all_matches[] = $match_record;
        file_put_contents(self::MATCHES_DATA_FILE, json_encode($all_matches, JSON_PRETTY_PRINT));
    }
}