-- ================================================================
--  SAFISHA WASTE MANAGEMENT — MySQL Database Schema
--  Run this file once to initialise the database:
--    mysql -u root -p < schema.sql
-- ================================================================

CREATE DATABASE IF NOT EXISTS safisha_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE safisha_db;

-- ----------------------------------------------------------------
-- 1. USERS  (clients & drivers share this table; role column
--            distinguishes them)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  role        ENUM('client','driver') NOT NULL DEFAULT 'client',
  full_name   VARCHAR(120)    NOT NULL,
  email       VARCHAR(200)    NOT NULL,
  phone       VARCHAR(30)     NOT NULL,
  location    VARCHAR(255)    NOT NULL,
  password    VARCHAR(255)    NOT NULL,  -- bcrypt hash

  -- Driver-only columns (NULL for clients)
  vehicle     VARCHAR(120)    NULL,
  license     VARCHAR(50)     NULL,

  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------
-- 2. GARBAGE POSTS  (created by clients)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS garbage_posts (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  client_id     INT UNSIGNED    NOT NULL,

  waste_type    VARCHAR(80)     NOT NULL,
  weight_range  VARCHAR(60)     NOT NULL,
  location      VARCHAR(255)    NOT NULL,
  description   TEXT            NOT NULL,
  pickup_date   DATE            NOT NULL,
  time_slot     VARCHAR(60)     NOT NULL,
  urgency       ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',

  status        ENUM(
                  'Pending',
                  'Accepted',
                  'Collected',
                  'At Facility',
                  'Completed'
                ) NOT NULL DEFAULT 'Pending',

  -- Populated when a driver accepts
  driver_id     INT UNSIGNED    NULL,
  accepted_at   DATETIME        NULL,

  -- Populated when driver marks collected
  collected_at  DATETIME        NULL,

  -- Populated when driver sends to facility
  facility_name VARCHAR(120)    NULL,
  driver_notes  TEXT            NULL,
  starting_bid  DECIMAL(12,2)   NULL,
  sent_at       DATETIME        NULL,

  -- Populated when facility places winning bid
  bid_winner    VARCHAR(150)    NULL,
  winning_bid   DECIMAL(12,2)   NULL,
  completed_at  DATETIME        NULL,

  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_post_client FOREIGN KEY (client_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_driver FOREIGN KEY (driver_id)
    REFERENCES users (id) ON DELETE SET NULL,

  INDEX idx_client  (client_id),
  INDEX idx_driver  (driver_id),
  INDEX idx_status  (status),
  INDEX idx_urgency (urgency),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------
-- 3. REFRESH TOKENS  (optional — for token rotation)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED  NOT NULL,
  token       VARCHAR(512)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------
-- 4.  SAMPLE SEED DATA  (for testing — password is "password123")
-- ----------------------------------------------------------------

-- bcrypt hash of "password123" with 10 rounds
INSERT IGNORE INTO users
  (role, full_name, email, phone, location, password)
VALUES
  ('client', 'Alice Kamau',  'alice@example.com',  '+254712000001', 'Westlands, Nairobi',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhy'),

  ('client', 'Bob Otieno',   'bob@example.com',    '+254712000002', 'Kasarani, Nairobi',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhy');

INSERT IGNORE INTO users
  (role, full_name, email, phone, location, password, vehicle, license)
VALUES
  ('driver', 'David Mwangi', 'david@example.com', '+254712000003', 'Embakasi, Nairobi',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhy',
   '5-ton lorry', 'KDA 456X'),

  ('driver', 'Grace Njeri',  'grace@example.com', '+254712000004', 'Langata, Nairobi',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhy',
   '3-ton pickup', 'KBC 789Y');
