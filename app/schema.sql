-- Graphic Generator database (Cloudflare D1)

-- One row per client per month: the month's posts as JSON. `rev` goes up on every save, and a
-- save must name the revision it started from, so simultaneous edits are caught.
CREATE TABLE IF NOT EXISTS months (
  client     TEXT NOT NULL,
  month      TEXT NOT NULL,          -- YYYY-MM
  data       TEXT NOT NULL,          -- { approved, posts:[…] }
  rev        INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (client, month)
);

-- A client review link: an unguessable token for one client's month.
CREATE TABLE IF NOT EXISTS reviews (
  token      TEXT PRIMARY KEY,
  client     TEXT NOT NULL,
  month      TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_month ON reviews (client, month);

-- What the client said about each post (history kept; the latest per post is current).
CREATE TABLE IF NOT EXISTS responses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL,
  post_id    TEXT NOT NULL,
  decision   TEXT NOT NULL,          -- approved | changes
  note       TEXT,
  name       TEXT,
  created_at TEXT NOT NULL
);

-- Each client's messaging guide (the file itself is in R2).
CREATE TABLE IF NOT EXISTS guides (
  client     TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL,
  mime       TEXT NOT NULL,
  name       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
