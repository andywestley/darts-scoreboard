<?php

namespace Darts;

use Darts\Controller\GameController;
use Darts\Controller\SetupController;
use Darts\Controller\StatsController;
use Darts\Data\Storage;

class App
{
    private Storage $storage;
    private array $routes = [];

    public function __construct()
    {
        // Define a constant for the project root path.
        if (!defined('ROOT_PATH')) {
            define('ROOT_PATH', dirname(__DIR__));
        }

        $this->initialize();
    }

    private function initialize(): void
    {
        // Dependency Injection Container (simple version)
        $this->storage = new Storage(ROOT_PATH);
        $setupController = new SetupController($this->storage);
        $gameController = new GameController($this->storage);
        $statsController = new StatsController($this->storage);

        // Simple Router
        $this->routes = [
            'add_player'        => [$setupController, 'addPlayer'],
            'get_setup_players' => [$setupController, 'getSetupPlayers'],
            'remove_player'     => [$setupController, 'removePlayer'],
            'start_game'        => [$setupController, 'startGame'],
            'reset'             => [$setupController, 'reset'], // Handle session reset
            'submit_score'      => [$gameController, 'submitScore'],
            'start_new_leg'     => [$gameController, 'startNewLeg'],
            'undo'              => [$gameController, 'undo'],
            'get_players'       => [$statsController, 'getPlayers'],
            'get_matches'       => [$statsController, 'getMatches'],
            'get_h2h_stats'     => [$statsController, 'getH2HStats'],
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