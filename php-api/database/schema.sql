-- Apply only to a dedicated TX.TOP STAGING MySQL database.
CREATE TABLE IF NOT EXISTS video_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  poster_url VARCHAR(2048) NULL,
  embed_url VARCHAR(2048) NOT NULL,
  rights_holder VARCHAR(180) NOT NULL,
  license_reference VARCHAR(180) NOT NULL,
  license_expires_at DATETIME NOT NULL,
  status ENUM('draft','pending_review','approved','published','rejected','archived') NOT NULL DEFAULT 'pending_review',
  year SMALLINT UNSIGNED NULL,
  duration VARCHAR(40) NULL,
  rating VARCHAR(20) NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_video_status_published (status, published_at),
  KEY idx_video_category_status (category, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
