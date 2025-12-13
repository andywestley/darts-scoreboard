<?php

namespace Darts;

use Darts\Controller\GameController;
use Darts\Controller\SetupController;
use Darts\Controller\StatsController;
use Darts\Service\Logger;
use Darts\Service\GameService;
use Darts\Data\Storage;

class App
{
    private Storage $storage;
    private Logger $logger;
    private array $routes = [];

    public function __construct(Logger $logger)
    {
        // Define a constant for the project root path.
        if (!defined('ROOT_PATH')) {
            define('ROOT_PATH', dirname(__DIR__));
        }
        $this->logger = $logger;

        $this->initialize($logger);
    }

    private function initialize(Logger $logger): void
    {
        // Dependency Injection Container (simple version)
        $this->storage = new Storage(ROOT_PATH, $logger);
        // Pass the logger to the controllers that need it
        $setupController = new SetupController($this->storage, $logger);
        $statsController = new StatsController($this->storage, $logger);

        // Create the GameService and inject it into the GameController
        $gameService = new GameService($logger);
        $gameController = new GameController($gameService, $logger);

        // Simple Router
        $this->routes = [
            'auth:getToken'     => [$setupController, 'getAnonymousToken'],
            'player:persist'    => [$setupController, 'persistPlayer'], // Persists a player name to the master list
            'player:get_all'    => [$statsController, 'getPlayers'],    // For stats screen
            'game:start'        => [$setupController, 'startGame'],
            'game:score'        => [$gameController, 'score'],
            'game:nextLeg'      => [$gameController, 'nextLeg'],
            'session:reset'     => [$setupController, 'reset'],
            'stats:matches'     => [$statsController, 'getMatches'],
            'stats:h2h'         => [$statsController, 'getH2HStats'],
        ];
    }

    public function run(string $action): void
    {
        if (!empty($action) && isset($this->routes[$action])) {
            $route = $this->routes[$action];
            if (is_callable($route)) {
                // Unpack the controller and method for clarity
                [$controller, $method] = $route;
                // Call the controller method
                $controller->$method();
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Invalid route configuration']);
            }
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Action not found']);
        }
    }
}