<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');


$host = 'localhost';
$db   = 'banana_bounce_db';
$user = 'root';
$pass = ''; // Common XAMPP default; use your own password if configured.

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$action = $_GET['action'] ?? 'leaderboard';

if ($action === 'score') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true);

    $name = trim(strip_tags((string)($body['name'] ?? 'Jungle Player')));
    $name = mb_substr($name !== '' ? $name : 'Jungle Player', 0, 40);
    $score = filter_var($body['score'] ?? null, FILTER_VALIDATE_INT);
    $bananas = filter_var($body['bananas'] ?? 0, FILTER_VALIDATE_INT);

    if ($score === false || $score < 0 ||
        $bananas === false || $bananas < 0) {
        http_response_code(422);
        echo json_encode(['error' => 'Invalid score']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO leaderboard_scores
         (player_name, score, bananas)
         VALUES (?, ?, ?)'
    );
    $stmt->execute([$name, $score, $bananas]);

    echo json_encode([
        'success' => true,
        'message' => 'Score saved to MySQL',
        'id' => $pdo->lastInsertId()
    ]);
    exit;
}

if ($action === 'leaderboard') {
    $stmt = $pdo->query(
        'SELECT player_name AS name, score, bananas, created_at
         FROM leaderboard_scores
         ORDER BY score DESC, created_at ASC
         LIMIT 10'
    );

    echo json_encode(['scores' => $stmt->fetchAll()]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action']);
