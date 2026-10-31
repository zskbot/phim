# TX.TOP — PHP 8.5 + MySQL staging API

This is a parallel backend target. It does not replace the existing Next.js frontend, Netlify site, or provider sandbox.

## Runtime requirements
- PHP 8.5.x
- PDO MySQL (pdo_mysql), JSON, mbstring, filter, openssl
- Apache with mod_rewrite and AllowOverride All, or Nginx with try_files
- MySQL 8.0+ / MariaDB 10.6+
- HTTPS and a dedicated, empty staging database

The runtime information supplied reports PHP 8.5.12 and includes PDO, pdo_mysql, mbstring, JSON, cURL and Imagick. The web-SAPI configuration, web server routing, and live DB connection still need verification.

## Deployment layout
Set the domain/subdomain document root to php-api/public. Do not expose php-api/src, php-api/database, or environment files through the web root.
For Nginx, route missing paths to /index.php?$query_string and pass PHP files to PHP-FPM. For Apache, enable mod_rewrite and allow the included .htaccess.

## Staging setup
1. Create a new empty MySQL database, e.g. txtop_staging.
2. Create a database user scoped only to that database.
3. Import php-api/database/schema.sql into that staging database.
4. Configure values from php-api/.env.staging.example in the host's secret/environment settings. Generate a long random ADMIN_API_TOKEN there. Never commit real secrets or send them in chat.
5. Set CORS_ALLOWED_ORIGINS to the exact staging frontend origin; do not use a wildcard.
6. Deploy php-api to a separate staging subdomain or API path. Keep the current Next.js app as the frontend.
7. Verify GET /api/v1/health returns HTTP 200 and database=connected.
8. Verify unauthenticated admin calls return HTTP 401 and only published records appear in public reads.

## API
- GET /api/v1/health — PHP and MySQL health.
- GET /api/v1/videos?limit=24&category=... — published catalogue.
- GET /api/v1/videos?id=123 — one published video.
- POST /api/v1/admin/videos — create pending-review record; requires X-Admin-Token.
- PATCH /api/v1/admin/videos/{id} — review/publish/archive; requires X-Admin-Token.

Publishing requires an approved item and future license expiry. Embed URLs are HTTPS-only and restricted to YouTube privacy-enhanced player, Vimeo player, or explicitly allowlisted hosts.

## Deployment blocker
The PHP version/extensions were supplied, but no staging hostname, SSH/SFTP/FTP route, hosting-panel access, or MySQL staging connection is available in the current context. Repository scaffolding can be prepared, but a live deployment and DB smoke test cannot yet be claimed. Provide the staging hostname and secure deployment route. Enter database passwords and API tokens directly into the host's secret settings, not into chat or GitHub.
