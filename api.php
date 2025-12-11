<?php

use Darts\Controller\GameController;
use Darts\Controller\SetupController;
use Darts\Controller\StatsController;
use Darts\Data\Storage;

// Bootstrap the application
session_start();

// Manually include class files instead of using Composer's autoloader.
require_once __DIR__ . '/src/Data/Storage.php';
require_once __DIR__ . '/src/Controller/SetupController.php';
require_once __DIR__ . '/src/Controller/GameController.php';
require_once __DIR__ . '/src/Controller/StatsController.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'reset') {
    session_destroy();
    header('Location: /');
    exit;
}

header('Content-Type: application/json');

// Dependency Injection Container (simple version)
$storage = new Storage();
$setupController = new SetupController();
$gameController = new GameController($storage);
$statsController = new StatsController($storage);

// Simple Router
$routes = [
    'add_player'        => [$setupController, 'addPlayer'],
    'get_setup_players' => [$setupController, 'getSetupPlayers'],
    'remove_player'     => [$setupController, 'removePlayer'],
    'start_game'        => [$setupController, 'startGame'],
    'submit_score'      => [$gameController, 'submitScore'],
    'start_new_leg'     => [$gameController, 'startNewLeg'],
    'undo'              => [$gameController, 'undo'],
    'get_players'       => [$statsController, 'getPlayers'],
    'get_matches'       => [$statsController, 'getMatches'],
];

if (isset($routes[$action])) {
    $routes[$action]();
} else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Action not found']);
}