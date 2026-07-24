<?php
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json');
airforshare_require_auth_json();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$uploadDir = realpath(__DIR__ . '/assets/uploads');
$savedName = $_POST['saved_name'] ?? '';
$path = $_POST['path'] ?? '';

$name = $savedName ?: basename($path);
$name = basename($name);

if (!$uploadDir || !$name) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid file']);
    exit;
}

$filePath = realpath($uploadDir . DIRECTORY_SEPARATOR . $name);

if ($filePath && str_starts_with($filePath, $uploadDir) && is_file($filePath)) {
    unlink($filePath);
}

echo json_encode(['success' => true]);
