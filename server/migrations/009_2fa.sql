-- Migration 009: Two-Factor Authentication
-- Adds user_2fa table for TOTP-based 2FA

CREATE TABLE IF NOT EXISTS user_2fa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER UNIQUE NOT NULL,
    secret TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
);
