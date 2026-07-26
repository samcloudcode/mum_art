-- ============================================================================
-- Create a scoped Postgres role for agent database work
-- ============================================================================
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Why not just use the `postgres` account: the connection string currently in
-- the environment is the project superuser, which can drop any table in the
-- database. This role is limited to reading and writing the application tables,
-- is revocable on its own, and shows up distinctly in Postgres logs so agent
-- changes are attributable.
--
-- WHAT THIS ROLE CANNOT DO, BY DESIGN
--   * No DELETE. Removing rows stays a human action.
--   * No DDL. ALTER TABLE requires table ownership in Postgres, which this role
--     does not have. Schema migrations are written as reviewed files in
--     supabase/migrations/ and applied by you in the SQL editor. That is
--     deliberate — it keeps schema changes deliberate and reviewable.
--   * No access to auth.*, storage.*, or any other schema.
--
-- BEFORE RUNNING: replace CHANGE_ME_STRONG_PASSWORD below with a generated
-- password. Do not reuse your database password. Keep it out of chat and out of
-- the repo — it goes straight into the environment variable in step 3.
-- ============================================================================


-- 1. The login role itself.
CREATE ROLE claude_agent WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

COMMENT ON ROLE claude_agent IS
    'Scoped role for Claude Code database work: read/write on app tables, no DDL, no DELETE.';


-- 2. Let it reach the database and the public schema.
GRANT CONNECT ON DATABASE postgres TO claude_agent;
GRANT USAGE   ON SCHEMA   public   TO claude_agent;


-- 3. Row Level Security.
--    Every policy on these tables is written `TO authenticated`. A plain login
--    role matches none of them, so without this grant the role would connect
--    successfully and then see zero rows — the confusing failure mode. Making
--    it a member of `authenticated` means it operates under exactly the same
--    RLS policies as a signed-in app user, no more and no less.
GRANT authenticated TO claude_agent;


-- 4. Table privileges. Deliberately no DELETE.
GRANT SELECT, INSERT, UPDATE ON editions      TO claude_agent;
GRANT SELECT, INSERT, UPDATE ON prints        TO claude_agent;
GRANT SELECT, INSERT, UPDATE ON distributors  TO claude_agent;
GRANT SELECT, INSERT         ON activity_log  TO claude_agent;
GRANT SELECT                 ON sync_logs     TO claude_agent;


-- 5. Sequences, so INSERTs into SERIAL-keyed tables (activity_log) work.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO claude_agent;


-- ============================================================================
-- Verify — run after the above and check the output looks right.
-- ============================================================================

-- Privileges actually granted:
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'claude_agent'
GROUP BY table_name
ORDER BY table_name;

-- Confirm it is NOT a superuser and cannot create databases or roles:
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname = 'claude_agent';
-- Expect: all four boolean columns false.


-- ============================================================================
-- To revoke later (single statement, does not affect your app or its keys):
--
--   DROP OWNED BY claude_agent;
--   DROP ROLE claude_agent;
-- ============================================================================
