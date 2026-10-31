<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/src/bootstrap.php';

use TxTop\Api\Http;
use TxTop\Api\Database;
use TxTop\Api\VideoRepository;

Http::run(static function (): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = rtrim((string) (getenv('API_BASE_PATH') ?: ''), '/');
    if ($base !== '' && str_starts_with($path, $base)) $path = substr($path, strlen($base)) ?: '/';
    $path = '/' . trim($path, '/');
    if ($path === '//') $path = '/';

    if ($method === 'GET' && $path === '/api/v1/health') {
        Database::connection()->query('SELECT 1');
        Http::json(['ok'=>true,'service'=>'TX.TOP PHP API','runtime'=>PHP_VERSION,'database'=>'connected','environment'=>getenv('APP_ENV') ?: 'unknown']);
    }
    if ($method === 'GET' && $path === '/api/v1/videos') {
        $repo = new VideoRepository(Database::connection());
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $video = $repo->findPublished($id);
            if (!$video) Http::json(['ok'=>false,'error'=>'Video not found'], 404);
            Http::json(['ok'=>true,'result'=>$video]);
        }
        $limit = filter_var($_GET['limit'] ?? 24, FILTER_VALIDATE_INT);
        $limit = max(1, min(100, $limit === false ? 24 : $limit));
        Http::json(['ok'=>true,'results'=>$repo->listPublished($limit, trim((string) ($_GET['category'] ?? '')))]);
    }
    if ($method === 'POST' && $path === '/api/v1/admin/videos') {
        Http::requireAdmin();
        $video = (new VideoRepository(Database::connection()))->createPending(Http::jsonBody());
        Http::json(['ok'=>true,'result'=>$video], 201);
    }
    if ($method === 'PATCH' && preg_match('#^/api/v1/admin/videos/([0-9]+)$#', $path, $matches)) {
        Http::requireAdmin();
        $payload = Http::jsonBody();
        $status = is_string($payload['status'] ?? null) ? $payload['status'] : '';
        $video = (new VideoRepository(Database::connection()))->transitionStatus($matches[1], $status);
        if (!$video) Http::json(['ok'=>false,'error'=>'Video not found'], 404);
        Http::json(['ok'=>true,'result'=>$video]);
    }
    Http::json(['ok'=>false,'error'=>'Not found'], 404);
});
