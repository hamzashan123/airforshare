<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$uploadDir = realpath(__DIR__ . '/assets/uploads');
if (!$uploadDir) {
    echo json_encode(['success' => true, 'deleted' => 0]);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
$files = $payload['files'] ?? [];
$deleted = 0;

foreach ($files as $file) {
    $name = basename($file['savedName'] ?? ($file['path'] ?? ''));
    if (!$name) continue;
    $filePath = realpath($uploadDir . DIRECTORY_SEPARATOR . $name);
    if ($filePath && str_starts_with($filePath, $uploadDir) && is_file($filePath)) {
        unlink($filePath);
        $deleted++;
    }
}

echo json_encode(['success' => true, 'deleted' => $deleted]);
