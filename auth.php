<?php

declare(strict_types=1);

session_start();

function airforshare_auth_email(): string
{
    return getenv('AIRFORSHARE_LOGIN_EMAIL') ?: 'admin@airforshare.local';
}

function airforshare_auth_password(): string
{
    return getenv('AIRFORSHARE_LOGIN_PASSWORD') ?: 'AirForShare@2026';
}

function airforshare_is_authenticated(): bool
{
    return !empty($_SESSION['airforshare_authenticated']);
}

function airforshare_attempt_login(string $email, string $password): bool
{
    $validEmail = hash_equals(strtolower(airforshare_auth_email()), strtolower(trim($email)));
    $validPassword = hash_equals(airforshare_auth_password(), $password);

    if (!$validEmail || !$validPassword) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['airforshare_authenticated'] = true;
    $_SESSION['airforshare_email'] = airforshare_auth_email();
    return true;
}

function airforshare_logout(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }

    session_destroy();
}

function airforshare_require_auth_json(): void
{
    if (airforshare_is_authenticated()) {
        return;
    }

    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Login required']);
    exit;
}
