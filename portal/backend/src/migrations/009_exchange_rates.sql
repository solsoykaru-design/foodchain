CREATE TABLE IF NOT EXISTS exchange_rates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_code   TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL DEFAULT '',
  symbol          TEXT NOT NULL DEFAULT '',
  rate            REAL NOT NULL DEFAULT 1,
  is_base         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO exchange_rates (currency_code, name, symbol, rate, is_base) VALUES ('RUB', 'Российский рубль', '₽', 1, 1);
INSERT OR IGNORE INTO exchange_rates (currency_code, name, symbol, rate) VALUES ('USD', 'Доллар США', '$', 100);
INSERT OR IGNORE INTO exchange_rates (currency_code, name, symbol, rate) VALUES ('EUR', 'Евро', '€', 105);
INSERT OR IGNORE INTO exchange_rates (currency_code, name, symbol, rate) VALUES ('KZT', 'Казахстанский тенге', '₸', 0.18);
INSERT OR IGNORE INTO exchange_rates (currency_code, name, symbol, rate) VALUES ('UZS', 'Узбекский сум', 'so''m', 0.0075);
