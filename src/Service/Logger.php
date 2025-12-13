<?php

namespace Darts\Service;

class Logger
{
    public const ERROR = 'ERROR';
    public const WARNING = 'WARNING';
    public const INFO = 'INFO';
    public const DEBUG = 'DEBUG';

    private string $logFile;
    private string $logLevel;

    private array $logLevelOrder = [
        self::DEBUG => 1,
        self::INFO => 2,
        self::WARNING => 3,
        self::ERROR => 4,
    ];

    /**
     * @param string $logFile The absolute path to the log file.
     * @param string $logLevel The minimum level to log (e.g., Logger::INFO).
     */
    public function __construct(string $logFile, string $logLevel = self::INFO)
    {
        $this->logFile = $logFile;
        $this->logLevel = $logLevel;
    }

    public function error(string $message, array $context = []): void
    {
        $this->log(self::ERROR, $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->log(self::WARNING, $message, $context);
    }

    public function info(string $message, array $context = []): void
    {
        $this->log(self::INFO, $message, $context);
    }

    public function log(string $level, string $message, array $context = []): void
    {
        if ($this->logLevelOrder[$level] < $this->logLevelOrder[$this->logLevel]) {
            return;
        }

        $logEntry = sprintf("[%s] [%s] %s %s\n", date('c'), $level, $message, $context ? json_encode($context) : '');
        file_put_contents($this->logFile, $logEntry, FILE_APPEND);
    }
}