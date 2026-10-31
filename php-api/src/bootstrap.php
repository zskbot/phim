<?php
declare(strict_types=1);
namespace TxTop\Api;

final class Http
{
    public static function run(callable $handler): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        header('Referrer-Policy: no-referrer');
        try {
            $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
            $allowed = array_filter(array_map('trim', explode(',', (string) getenv('CORS_ALLOWED_ORIGINS'))));
            if ($origin !== '' && in_array($origin, $allowed, true)) {
                header('Access-Control-Allow-Origin: ' . $origin);
                header('Vary: Origin');
            }
            if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
                header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token');
                http_response_code(204);
                return;
            }
            $handler();
        } catch (\InvalidArgumentException $error) {
            self::json(['ok'=>false,'error'=>$error->getMessage()], 422);
        } catch (\Throwable $error) {
            error_log('[tx-top-api] ' . $error::class . ': ' . $error->getMessage());
            self::json(['ok'=>false,'error'=>'Internal server error'], 500);
        }
    }

    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    public static function jsonBody(): array
    {
        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($length > 65536) self::json(['ok'=>false,'error'=>'Request body too large'], 413);
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (!is_string($raw) || strlen($raw) > 65536) self::json(['ok'=>false,'error'=>'Request body too large'], 413);
        try { $data = json_decode($raw ?: '{}', true, 32, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new \InvalidArgumentException('Invalid JSON body'); }
        if (!is_array($data) || array_is_list($data)) throw new \InvalidArgumentException('A JSON object is required');
        return $data;
    }

    public static function requireAdmin(): void
    {
        $expected = (string) getenv('ADMIN_API_TOKEN');
        $provided = (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
        if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
            self::json(['ok'=>false,'error'=>'Unauthorized'], 401);
        }
    }
}

final class Database
{
    private static ?\PDO $connection = null;
    public static function connection(): \PDO
    {
        if (self::$connection instanceof \PDO) return self::$connection;
        $host = (string) getenv('DB_HOST');
        $name = (string) getenv('DB_NAME');
        $user = (string) getenv('DB_USER');
        $pass = (string) getenv('DB_PASSWORD');
        $port = (string) (getenv('DB_PORT') ?: '3306');
        if ($host === '' || $name === '' || $user === '') throw new \RuntimeException('Database environment is incomplete');
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
        self::$connection = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE=>\PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES=>false,
            \PDO::ATTR_TIMEOUT=>5,
        ]);
        return self::$connection;
    }
}

final class VideoRepository
{
    public function __construct(private readonly \PDO $db) {}

    public function listPublished(int $limit, string $category = ''): array
    {
        $sql = "SELECT id,title,description,category,poster_url,embed_url,year,duration,rating,views,published_at FROM video_catalog WHERE status='published'";
        $params = [];
        if ($category !== '') { $sql .= ' AND category=:category'; $params['category'] = mb_substr($category, 0, 80); }
        $sql .= ' ORDER BY published_at DESC LIMIT ' . $limit;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findPublished(string $id): ?array
    {
        if (!ctype_digit($id)) return null;
        $stmt = $this->db->prepare("SELECT id,title,description,category,poster_url,embed_url,year,duration,rating,views,published_at FROM video_catalog WHERE id=:id AND status='published' LIMIT 1");
        $stmt->execute(['id'=>$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createPending(array $input): array
    {
        $title = $this->text($input['title'] ?? null, 240, true);
        $category = $this->text($input['category'] ?? null, 80, true);
        $rights = $this->text($input['rights_holder'] ?? null, 180, true);
        $license = $this->text($input['license_reference'] ?? null, 180, true);
        $expires = $this->text($input['license_expires_at'] ?? null, 40, true);
        if (strtotime($expires) === false || strtotime($expires) <= time()) throw new \InvalidArgumentException('A future license expiry date is required');
        $embed = $this->safeEmbed($input['embed_url'] ?? null);
        $poster = $this->safeHttps($input['poster_url'] ?? null, false);
        $description = $this->text($input['description'] ?? '', 4000, false);
        $stmt = $this->db->prepare("INSERT INTO video_catalog (title,description,category,poster_url,embed_url,rights_holder,license_reference,license_expires_at,status) VALUES (:title,:description,:category,:poster,:embed,:rights,:license,:expires,'pending_review')");
        $stmt->execute(['title'=>$title,'description'=>$description,'category'=>$category,'poster'=>$poster,'embed'=>$embed,'rights'=>$rights,'license'=>$license,'expires'=>date('Y-m-d H:i:s', strtotime($expires))]);
        $id = (string) $this->db->lastInsertId();
        $query = $this->db->prepare('SELECT id,title,category,status,created_at FROM video_catalog WHERE id=:id');
        $query->execute(['id'=>$id]);
        return $query->fetch() ?: ['id'=>$id,'status'=>'pending_review'];
    }

    public function transitionStatus(string $id, string $next): ?array
    {
        $allowed = ['pending_review'=>['approved','rejected','archived'],'approved'=>['published','archived'],'published'=>['archived'],'rejected'=>['archived'],'draft'=>['pending_review','archived'],'archived'=>[]];
        if (!in_array($next, ['draft','pending_review','approved','published','rejected','archived'], true)) throw new \InvalidArgumentException('Invalid status');
        $this->db->beginTransaction();
        try {
            $select = $this->db->prepare('SELECT * FROM video_catalog WHERE id=:id FOR UPDATE');
            $select->execute(['id'=>$id]);
            $item = $select->fetch();
            if (!$item) { $this->db->commit(); return null; }
            if (!in_array($next, $allowed[$item['status']] ?? [], true)) throw new \InvalidArgumentException('Invalid status transition');
            if ($next === 'published') {
                if (strtotime((string) $item['license_expires_at']) <= time()) throw new \InvalidArgumentException('Cannot publish: license has expired');
                $this->safeEmbed($item['embed_url']);
            }
            $update = $this->db->prepare('UPDATE video_catalog SET status=:status,published_at=IF(:published=1,NOW(),published_at),updated_at=NOW() WHERE id=:id');
            $update->execute(['status'=>$next,'published'=>$next==='published'?1:0,'id'=>$id]);
            $this->db->commit();
            return ['id'=>$id,'status'=>$next];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function text(mixed $value, int $max, bool $required): string
    {
        $value = is_string($value) ? trim(strip_tags($value)) : '';
        if ($required && $value === '') throw new \InvalidArgumentException('A required field is missing');
        return mb_substr($value, 0, $max);
    }

    private function safeHttps(mixed $value, bool $required): ?string
    {
        if (!is_string($value) || trim($value)==='') {
            if ($required) throw new \InvalidArgumentException('A valid HTTPS URL is required');
            return null;
        }
        $url = filter_var($value, FILTER_VALIDATE_URL);
        $parts = $url ? parse_url($url) : false;
        if (!$parts || strtolower((string)($parts['scheme']??''))!=='https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) throw new \InvalidArgumentException('Only safe HTTPS URLs are accepted');
        return $url;
    }

    private function safeEmbed(mixed $value): string
    {
        $url = $this->safeHttps($value, true);
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $allowed = ['youtube-nocookie.com','player.vimeo.com'];
        $extra = array_filter(array_map('trim', explode(',', (string)getenv('VIDEO_EMBED_ALLOWED_HOSTS'))));
        foreach ($extra as $domain) $allowed[] = strtolower($domain);
        foreach ($allowed as $domain) if ($host===$domain || str_ends_with($host, '.'.$domain)) return $url;
        throw new \InvalidArgumentException('Embed host is not allowlisted');
    }
}
