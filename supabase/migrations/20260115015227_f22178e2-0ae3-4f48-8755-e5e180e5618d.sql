-- ==========================================================================
-- Dynamic FK Blocker Discovery RPCs for Admin User Deletion
-- SECURITY DEFINER + row_security = off to bypass RLS and discover all FKs
-- ==========================================================================

-- 1) get_profile_fk_blockers: Find all FKs referencing public.profiles(id)
CREATE OR REPLACE FUNCTION public.get_profile_fk_blockers(p_profile_id uuid)
RETURNS TABLE (
  schema_name text,
  table_name text,
  column_name text,
  constraint_name text,
  on_delete text,
  match_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  rec record;
  cnt bigint;
BEGIN
  FOR rec IN
    SELECT
      nsp.nspname::text AS schema_name,
      cls.relname::text AS table_name,
      att.attname::text AS column_name,
      con.conname::text AS constraint_name,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE 'UNKNOWN'
      END AS on_delete
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.confrelid = 'public.profiles'::regclass
      AND con.contype = 'f'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      rec.schema_name, rec.table_name, rec.column_name
    ) INTO cnt USING p_profile_id;
    
    IF cnt > 0 THEN
      schema_name := rec.schema_name;
      table_name := rec.table_name;
      column_name := rec.column_name;
      constraint_name := rec.constraint_name;
      on_delete := rec.on_delete;
      match_count := cnt;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 2) get_auth_user_fk_blockers: Find all FKs referencing auth.users(id)
CREATE OR REPLACE FUNCTION public.get_auth_user_fk_blockers(p_user_id uuid)
RETURNS TABLE (
  schema_name text,
  table_name text,
  column_name text,
  constraint_name text,
  on_delete text,
  match_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  rec record;
  cnt bigint;
BEGIN
  FOR rec IN
    SELECT
      nsp.nspname::text AS schema_name,
      cls.relname::text AS table_name,
      att.attname::text AS column_name,
      con.conname::text AS constraint_name,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE 'UNKNOWN'
      END AS on_delete
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.confrelid = 'auth.users'::regclass
      AND con.contype = 'f'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      rec.schema_name, rec.table_name, rec.column_name
    ) INTO cnt USING p_user_id;
    
    IF cnt > 0 THEN
      schema_name := rec.schema_name;
      table_name := rec.table_name;
      column_name := rec.column_name;
      constraint_name := rec.constraint_name;
      on_delete := rec.on_delete;
      match_count := cnt;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ==========================================================================
-- Security: Lock down EXECUTE privileges (SECURITY DEFINER = dangerous if PUBLIC can call)
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.get_profile_fk_blockers(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_fk_blockers(uuid) FROM PUBLIC;

-- Allow only service_role (edge functions use this role)
GRANT EXECUTE ON FUNCTION public.get_profile_fk_blockers(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_fk_blockers(uuid) TO service_role;