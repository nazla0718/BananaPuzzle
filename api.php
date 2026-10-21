<?php

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
$action = $_GET['action'] ?? 'leaderboard';
$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'scores.json';

function read_scores(string $file): array {
    if (!is_file($file)) return [];
    $raw = file_get_contents($file);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}
function respond(array $payload, int $status=200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
if ($action === 'score') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error'=>'POST required'], 405);
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) respond(['error'=>'Invalid JSON body'], 400);
    $name = trim(strip_tags((string)($body['name'] ?? 'Jungle Player')));
    $name = mb_substr($name !== '' ? $name : 'Jungle Player', 0, 40);
    $score = filter_var($body['score'] ?? 0, FILTER_VALIDATE_INT);
    $bananas = filter_var($body['bananas'] ?? 0, FILTER_VALIDATE_INT);
    if ($score === false || $bananas === false || $score < 0 || $bananas < 0) respond(['error'=>'Invalid score'], 422);
    $scores = read_scores($dataFile);
    $scores[] = ['name'=>$name, 'score'=>$score, 'bananas'=>$bananas, 'updatedAt'=>gmdate('c')];
    usort($scores, fn($a,$b) => ($b['score'] ?? 0) <=> ($a['score'] ?? 0));
    $scores = array_slice($scores, 0, 100);
    $fp = fopen($dataFile, 'c+');
    if (!$fp) respond(['error'=>'Could not store score'], 500);
    flock($fp, LOCK_EX);
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp); flock($fp, LOCK_UN); fclose($fp);
    respond(['ok'=>true, 'saved'=>true]);
}
if ($action === 'leaderboard') {
    $scores = read_scores($dataFile);
    usort($scores, fn($a,$b) => ($b['score'] ?? 0) <=> ($a['score'] ?? 0));
    respond(['scores'=>array_slice($scores, 0, 20)]);
}
respond(['error'=>'Unknown action'], 404);
?>