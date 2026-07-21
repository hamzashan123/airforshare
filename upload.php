<?php
header('Content-Type: application/json');

$uploadDir = __DIR__ . '/assets/uploads/';
$publicDir = 'assets/uploads/';
$maxSize = 500 * 1024 * 1024; // 50 MB

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No file received']);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

if ($file['size'] > $maxSize) {
    http_response_code(413);
    echo json_encode(['success' => false, 'message' => 'File is larger than 50 MB']);
    exit;
}

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$original = basename($file['name']);
$extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));
$safeBase = preg_replace('/[^a-zA-Z0-9-_\.]/', '-', pathinfo($original, PATHINFO_FILENAME));
$safeBase = trim($safeBase, '-_') ?: 'file';
$savedName = $safeBase . '-' . bin2hex(random_bytes(8)) . ($extension ? '.' . $extension : '');
$target = $uploadDir . $savedName;

if (!move_uploaded_file($file['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not save file']);
    exit;
}

$type = mime_content_type($target) ?: 'application/octet-stream';

// Build a public URL relative to this app.
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '';
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$url = $host ? $scheme . '://' . $host . $basePath . '/' . $publicDir . rawurlencode($savedName) : $publicDir . $savedName;

echo json_encode([
    'success' => true,
    'original_name' => $original,
    'saved_name' => $savedName,
    'path' => $publicDir . $savedName,
    'url' => $url,
    'size' => filesize($target),
    'type' => $type
]);
