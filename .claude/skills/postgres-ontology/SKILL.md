---
name: postgres-ontology
description: Use when designing a Postgres schema that must model typed entities and typed relations (an ontology / knowledge graph), migrating SQLite→Postgres, or deciding between plain relational, JSONB+registry, Apache AGE, and a triple store. Covers the staged approach, validation, and the Rust/SeaORM side.
---

# Ontology-shaped schemas in Postgres

For when fixed tables stop fitting: you want to add entity kinds and relation kinds
without a migration each time, and traverse them.

## 1. Do not start with the ontology

**The single most common failure is modelling enterprise-first instead of use-case-first.**
Abandoned ontologies are almost always beautiful, general, and answer no question anyone asked.

Before any DDL, write the **competency questions** — the queries the schema exists to
answer. "Which tasks block the Souge deliverable?" "What did I touch for this client
across all projects?" If a modelling choice doesn't serve one, cut it. Keep the list
in the repo; new questions justify schema changes, and nothing else does.

## 2. Pick the mechanism — in this order

Escalate only when the previous rung actually breaks.

| Rung | Mechanism | Use when |
|---|---|---|
| 1 | **Plain relational**, one table per kind | Kinds are few and stable. Almost always start here. |
| 2 | **Core + JSONB + predicate registry** | Kinds are open-ended; traversal is ≤3 hops. **Usually the answer.** |
| 3 | **Apache AGE** (openCypher in Postgres) | Genuine variable-depth traversal, path queries, Cypher. |
| 4 | **Dedicated graph/triple store** | Reasoning (OWL/SHACL inference), billions of edges. |

**Rung 2 is the sweet spot** for an app that wants an ontology without becoming a
graph database. Rung 3 costs you a compiled extension: AGE ships on few managed
Postgres services, so you pin your hosting the day you adopt it. Worth it for real
Cypher traversal; a bad trade for "we might want a graph someday."

## 3. Rung 2, concretely

Route every property one of two ways — **intrinsic** (an attribute you look up) goes in
the node; **relational** (something you traverse) becomes an edge. Getting this split
right is most of the design.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS ltree;      -- hierarchy paths

-- ── schema of the schema ────────────────────────────────────────────
CREATE TABLE entity_type (
  key          text PRIMARY KEY,              -- 'task', 'project', 'person'
  label        text NOT NULL,
  attr_schema  jsonb NOT NULL DEFAULT '{}',   -- JSON Schema for entity.attrs
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE predicate (                      -- the relation registry
  key         text PRIMARY KEY,               -- 'blocks', 'assigned_to'
  label       text NOT NULL,
  domain      text NOT NULL REFERENCES entity_type(key),  -- subject kind
  range       text NOT NULL REFERENCES entity_type(key),  -- object kind
  inverse_key text REFERENCES predicate(key),
  transitive  boolean NOT NULL DEFAULT false,
  symmetric   boolean NOT NULL DEFAULT false
);

-- ── the data ────────────────────────────────────────────────────────
CREATE TABLE entity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key   text NOT NULL REFERENCES entity_type(key),
  owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  attrs      jsonb NOT NULL DEFAULT '{}',     -- intrinsic properties
  path       ltree,                           -- materialised hierarchy
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE edge (
  subject_id    uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  predicate_key text NOT NULL REFERENCES predicate(key),
  object_id     uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  attrs         jsonb NOT NULL DEFAULT '{}',  -- properties OF the relation
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, predicate_key, object_id)
);

-- ── indexes that make it usable ─────────────────────────────────────
CREATE INDEX ON entity (type_key, owner_id);
CREATE INDEX ON entity USING gin (attrs jsonb_path_ops);
CREATE INDEX ON entity USING gist (path);
CREATE INDEX ON edge (object_id, predicate_key);   -- reverse traversal
```

The forward edge index is the primary key; **the reverse index is the one people
forget**, and without it every "what points at me" query is a seq scan.

### Validate the JSONB or it becomes a swamp

`jsonb` with no contract is how this design rots. Enforce each type's `attr_schema`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

ALTER TABLE entity ADD CONSTRAINT entity_attrs_valid CHECK (
  jsonb_matches_schema(
    (SELECT attr_schema FROM entity_type WHERE key = type_key), attrs)
);
```

If `pg_jsonschema` isn't available on your host, do it in a `BEFORE INSERT OR UPDATE`
trigger, or validate in the API layer against the same schema. Pick one and make it
non-optional — this is the SHACL-equivalent, and teams that skip it report materially
worse data quality.

### Enforce domain/range too

A predicate registry that nothing checks is documentation, not a constraint:

```sql
CREATE OR REPLACE FUNCTION edge_types_ok() RETURNS trigger AS $$
DECLARE d text; r text;
BEGIN
  SELECT domain, range INTO d, r FROM predicate WHERE key = NEW.predicate_key;
  IF (SELECT type_key FROM entity WHERE id = NEW.subject_id) IS DISTINCT FROM d THEN
    RAISE EXCEPTION 'predicate % expects subject of type %', NEW.predicate_key, d;
  END IF;
  IF (SELECT type_key FROM entity WHERE id = NEW.object_id) IS DISTINCT FROM r THEN
    RAISE EXCEPTION 'predicate % expects object of type %', NEW.predicate_key, r;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER edge_types_ok BEFORE INSERT OR UPDATE ON edge
  FOR EACH ROW EXECUTE FUNCTION edge_types_ok();
```

### Traversal without a graph engine

Recursive CTE handles variable depth fine at app scale:

```sql
WITH RECURSIVE reachable AS (
  SELECT object_id AS id, 1 AS depth
    FROM edge WHERE subject_id = $1 AND predicate_key = 'blocks'
  UNION
  SELECT e.object_id, r.depth + 1
    FROM edge e JOIN reachable r ON e.subject_id = r.id
   WHERE e.predicate_key = 'blocks' AND r.depth < 10   -- ALWAYS bound the depth
)
SELECT * FROM reachable;
```

Unbounded recursion on a cyclic graph hangs. Bound the depth, always.

## 4. SQLite → Postgres migration

Type mapping — the first two are where SQLite schemas are silently wrong:

| SQLite | Postgres | Note |
|---|---|---|
| `BLOB` holding a UUID | `uuid` | Native type; indexes and reads better |
| `TEXT` holding a datetime | `timestamptz` | Store UTC, never naive `timestamp` |
| `INTEGER` 0/1 | `boolean` | |
| `TEXT` from a fixed set | `text` + `CHECK` | Prefer over `CREATE TYPE`: adding a value to a native enum is a migration, a CHECK is one statement |
| `TEXT` email | `citext` | Case-insensitive uniqueness for free |

**`PRAGMA foreign_keys` is per-connection in SQLite** — an app connection that never
sets it silently skips every `ON DELETE CASCADE`, so an existing SQLite database may
already hold orphan rows. Check for them *before* migrating, or the FK creation on the
Postgres side will fail with a constraint violation and you'll debug the wrong thing.

Order of work: create Postgres schema → dual-write or take a maintenance window →
copy with explicit casts → **verify row counts and orphans** → cut over → keep the
SQLite file for a while.

## 5. Rust side

- **SeaORM** for CRUD over the typed entities — it's built on sqlx and gives you
  ActiveModel ergonomics. Keep it if you already have it; the backend switch is
  mostly the `DATABASE_URL` and the migration files.
- **sqlx directly** for the recursive CTEs and JSONB queries. SeaORM's query builder
  makes these worse, not better. Both can share one pool — SeaORM exposes it.
- Map `jsonb` to `serde_json::Value`, or to a typed struct per entity kind, validated
  at the edge. Prefer the typed struct in handlers; keep `Value` at the storage boundary.
- Write migrations as **plain `.sql` files** (`sqlx migrate` or SeaORM's
  `execute_unprepared`). Triggers, extensions, partial indexes and CHECK constraints
  don't survive an ORM DSL — and this schema is mostly those.
- Set `search_path` and run migrations on boot behind an advisory lock so concurrent
  replicas don't race.

## 6. Treat the ontology as code

- Version `entity_type` and `predicate` rows in migrations, not by hand in prod.
- Review schema changes like code — a new predicate is an API change.
- Add a competency question whenever the product asks something new; if no query
  covers it, that's the ticket.
- Backfill and validate in the same migration that adds a constraint, or the
  constraint will fail on real data at the worst moment.
