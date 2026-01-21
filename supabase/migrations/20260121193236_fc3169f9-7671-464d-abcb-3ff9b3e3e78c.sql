-- FINAL INTEGRATED SCHEMA (Antigravity + Lovable Compatible)
-- Checks: Permissive RLS, Correct Column Names for Frontend

-- 1. DROP EXISTING TABLES to ensure clean slate (and avoid column mismatch errors)
-- CAUTION: This wipes data (which is fine for dev/setup phase)
DROP TABLE IF EXISTS clearcheck_flag_events CASCADE;
DROP TABLE IF EXISTS clearcheck_flagged_orders CASCADE;
DROP TABLE IF EXISTS clearcheck_order_changes CASCADE;
DROP TABLE IF EXISTS clearcheck_order_snapshots CASCADE;
DROP TABLE IF EXISTS clearcheck_contact_attempts CASCADE;
DROP TABLE IF EXISTS clearcheck_staging_rows CASCADE;
DROP TABLE IF EXISTS clearcheck_orders CASCADE;
DROP TABLE IF EXISTS clearcheck_import_batches CASCADE;
DROP TABLE IF EXISTS clearcheck_flag_definitions CASCADE;

-- 2. CREATE BASE TABLES (Using Frontend-Compatible Column Names)
CREATE TABLE public.clearcheck_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    import_type text NOT NULL,
    system text NOT NULL,
    filename text,
    row_count integer DEFAULT 0,
    warnings text [],
    errors text [],
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clearcheck_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_instance_key text UNIQUE NOT NULL,
    -- Names match ImportPage.tsx and Parser logic
    job_id text,
    status text,
    service text,
    street text,
    city text,
    state text,
    zip text,
    county text,
    client_primary text,
    subclient text,
    rep_display_name text,
    due_client date,
    due_rep date,
    current_ecd date,
    is_open boolean DEFAULT true,
    -- Continuity Links
    import_batch_id uuid REFERENCES public.clearcheck_import_batches(id),
    -- Operational
    current_delay_reason_code text,
    current_delay_reason_label text,
    created_date timestamp,
    completed_date timestamp,
    submitted_date timestamp,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.clearcheck_staging_rows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid REFERENCES public.clearcheck_import_batches(id) ON DELETE CASCADE,
    raw jsonb,
    parsed jsonb,
    is_valid boolean DEFAULT true,
    error_text text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clearcheck_contact_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    method text CHECK (method IN ('CALL', 'TEXT', 'EMAIL')),
    notes text,
    created_by uuid,
    created_at timestamptz DEFAULT now()
);

-- 3. CONTINUITY ENGINE TABLES
CREATE TABLE public.clearcheck_flag_definitions (
    code text PRIMARY KEY,
    label text NOT NULL,
    description text,
    severity text CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
    category text CHECK (category IN ('DATA_QUALITY', 'SLA', 'PROCESS', 'SYSTEM')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

INSERT INTO clearcheck_flag_definitions (code, label, description, severity, category)
VALUES 
    ('REQ_MISSING_COUNTY', 'Missing County', 'Order is missing county data', 'WARN', 'DATA_QUALITY'),
    ('REQ_MISSING_STATE', 'Missing State', 'Order is missing state data', 'WARN', 'DATA_QUALITY'),
    ('SLA_STALE_3BD', 'Stale (3+ BD)', 'No update for 3+ business days', 'WARN', 'SLA'),
    ('SLA_STALE_5BD', 'Stale (5+ BD)', 'No update for 5+ business days', 'CRITICAL', 'SLA'),
    ('LOCKED_FIELD_DRIFT', 'Data Refresh Drift', 'Critical locked fields changed unexpectedly', 'INFO', 'SYSTEM'),
    ('STATUS_REGRESSION', 'Status Regression', 'Order moved backwards in status workflow', 'WARN', 'PROCESS')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.clearcheck_order_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    import_batch_id uuid NOT NULL REFERENCES public.clearcheck_import_batches(id),
    snapshot_at timestamptz DEFAULT now(),
    status text,
    current_ecd date,
    due_client date,
    due_rep date,
    job_id text,
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(order_id, import_batch_id)
);

CREATE TABLE public.clearcheck_order_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    snapshot_id uuid NOT NULL REFERENCES public.clearcheck_order_snapshots(id),
    previous_snapshot_id uuid REFERENCES public.clearcheck_order_snapshots(id),
    field_name text NOT NULL,
    old_value text,
    new_value text,
    change_type text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clearcheck_flagged_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    flag_code text NOT NULL REFERENCES public.clearcheck_flag_definitions(code),
    triggered_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}',
    UNIQUE(order_id, flag_code)
);

CREATE TABLE public.clearcheck_flag_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    flag_code text NOT NULL,
    event_type text CHECK (event_type IN ('TRIGGERED', 'CLEARED')),
    snapshot_id uuid REFERENCES public.clearcheck_order_snapshots(id),
    created_at timestamptz DEFAULT now()
);

-- 4. ENABLE RLS & ADD POLICIES (Fixes "Not Found" for Ops Users)
ALTER TABLE public.clearcheck_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_staging_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_order_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_order_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_flagged_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_flag_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_flag_definitions ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow Authenticated Users - e.g. Ops Staff)
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_staging_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_contact_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_order_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_order_changes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_flagged_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.clearcheck_flag_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON public.clearcheck_flag_definitions FOR SELECT TO authenticated USING (true);

-- 5. RE-DEFINE LOGIC (Required because tables were dropped)
CREATE OR REPLACE FUNCTION is_business_day(check_date date) RETURNS boolean AS $$
BEGIN
    RETURN EXTRACT(ISODOW FROM check_date) BETWEEN 1 AND 5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION business_days_diff(start_date date, end_date date) RETURNS integer AS $$
DECLARE
    curr_date date := start_date;
    bd_count integer := 0;
BEGIN
    IF start_date >= end_date THEN
        RETURN 0;
    END IF;
    WHILE curr_date < end_date LOOP
        curr_date := curr_date + 1;
        IF is_business_day(curr_date) THEN
            bd_count := bd_count + 1;
        END IF;
    END LOOP;
    RETURN bd_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION toggle_flag(
    p_order_id uuid,
    p_flag_code text,
    p_should_flag boolean,
    p_snapshot_id uuid
) RETURNS void AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM clearcheck_flagged_orders
        WHERE order_id = p_order_id AND flag_code = p_flag_code
    ) INTO v_exists;

    IF p_should_flag AND NOT v_exists THEN
        INSERT INTO clearcheck_flagged_orders (order_id, flag_code, triggered_at)
        VALUES (p_order_id, p_flag_code, now());
        INSERT INTO clearcheck_flag_events (order_id, flag_code, event_type, snapshot_id)
        VALUES (p_order_id, p_flag_code, 'TRIGGERED', p_snapshot_id);
    ELSIF NOT p_should_flag AND v_exists THEN
        DELETE FROM clearcheck_flagged_orders
        WHERE order_id = p_order_id AND flag_code = p_flag_code;
        INSERT INTO clearcheck_flag_events (order_id, flag_code, event_type, snapshot_id)
        VALUES (p_order_id, p_flag_code, 'CLEARED', p_snapshot_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_order_snapshots(
    p_import_batch_id uuid,
    p_orders jsonb[]
) RETURNS jsonb AS $$
DECLARE
    order_item jsonb;
    v_order_id uuid;
    v_snapshot_id uuid;
    v_prev_snapshot_id uuid;
    v_existing_snapshot_id uuid;
    v_prev_data jsonb;
    v_current_data jsonb;
    v_diff_key text;
    v_old_val text;
    v_new_val text;
    v_stats_upserted int := 0;
    v_stats_snapshots int := 0;
    v_missing_county boolean;
    v_missing_state boolean;
    v_stale_days int;
BEGIN
    FOREACH order_item IN ARRAY p_orders LOOP
        -- A. UPSERT ORDER
        INSERT INTO clearcheck_orders (
            order_instance_key, job_id, status, service, city, state, zip, county, street,
            client_primary, rep_display_name, due_client, due_rep, created_date, import_batch_id, updated_at
        )
        VALUES (
            order_item->>'order_instance_key',
            order_item->>'job_id',
            order_item->>'status',
            order_item->>'service',
            order_item->>'city',
            order_item->>'state',
            order_item->>'zip',
            order_item->>'county',
            order_item->>'street',
            order_item->>'client_primary',
            order_item->>'rep_display_name',
            (order_item->>'due_client')::date,
            (order_item->>'due_rep')::date,
            (order_item->>'created_date')::timestamp,
            p_import_batch_id,
            now()
        )
        ON CONFLICT (order_instance_key) DO UPDATE SET
            status = EXCLUDED.status,
            service = EXCLUDED.service,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip = EXCLUDED.zip,
            county = EXCLUDED.county,
            street = EXCLUDED.street,
            client_primary = EXCLUDED.client_primary,
            rep_display_name = EXCLUDED.rep_display_name,
            due_client = EXCLUDED.due_client,
            due_rep = EXCLUDED.due_rep,
            import_batch_id = EXCLUDED.import_batch_id,
            updated_at = now()
        RETURNING id INTO v_order_id;
        v_stats_upserted := v_stats_upserted + 1;

        -- B. CHECK IDEMPOTENCY
        SELECT id INTO v_existing_snapshot_id
        FROM clearcheck_order_snapshots
        WHERE order_id = v_order_id AND import_batch_id = p_import_batch_id;
        IF v_existing_snapshot_id IS NOT NULL THEN
            CONTINUE;
        END IF;

        -- C. CREATE SNAPSHOT
        v_current_data := order_item;
        INSERT INTO clearcheck_order_snapshots (
            order_id, import_batch_id, snapshot_at, status, current_ecd, due_client, due_rep, job_id, raw_data
        )
        VALUES (
            v_order_id, p_import_batch_id, now(),
            order_item->>'status',
            (order_item->>'current_ecd')::date,
            (order_item->>'due_client')::date,
            (order_item->>'due_rep')::date,
            order_item->>'job_id',
            v_current_data
        )
        RETURNING id INTO v_snapshot_id;
        v_stats_snapshots := v_stats_snapshots + 1;

        -- D. DIFFS
        SELECT id, raw_data INTO v_prev_snapshot_id, v_prev_data
        FROM clearcheck_order_snapshots
        WHERE order_id = v_order_id AND id != v_snapshot_id
        ORDER BY snapshot_at DESC
        LIMIT 1;

        IF v_prev_snapshot_id IS NOT NULL THEN
            FOR v_diff_key IN SELECT jsonb_object_keys(v_current_data) LOOP
                IF v_diff_key IN ('updated_at', 'created_at', 'import_date', 'order_instance_key', 'batch_id', 'id') THEN
                    CONTINUE;
                END IF;
                v_new_val := v_current_data->>v_diff_key;
                v_old_val := v_prev_data->>v_diff_key;
                IF v_new_val IS DISTINCT FROM v_old_val THEN
                    INSERT INTO clearcheck_order_changes (
                        order_id, snapshot_id, previous_snapshot_id, field_name, old_value, new_value, change_type
                    )
                    VALUES (v_order_id, v_snapshot_id, v_prev_snapshot_id, v_diff_key, v_old_val, v_new_val, 'UPDATE');
                END IF;
            END LOOP;
        END IF;

        -- E. FLAGS
        v_missing_county := (order_item->>'county') IS NULL OR (order_item->>'county') = '';
        PERFORM toggle_flag(v_order_id, 'REQ_MISSING_COUNTY', v_missing_county, v_snapshot_id);

        v_missing_state := (order_item->>'state') IS NULL OR (order_item->>'state') = '';
        PERFORM toggle_flag(v_order_id, 'REQ_MISSING_STATE', v_missing_state, v_snapshot_id);

        v_stale_days := business_days_diff(
            COALESCE((order_item->>'updated_at')::date, (order_item->>'created_date')::date, CURRENT_DATE),
            CURRENT_DATE
        );
        PERFORM toggle_flag(v_order_id, 'SLA_STALE_5BD', (v_stale_days >= 5), v_snapshot_id);
        PERFORM toggle_flag(v_order_id, 'SLA_STALE_3BD', (v_stale_days >= 3 AND v_stale_days < 5), v_snapshot_id);
    END LOOP;

    RETURN jsonb_build_object('upserted', v_stats_upserted, 'snapshots', v_stats_snapshots);
END;
$$ LANGUAGE plpgsql;

-- 6. FORCE RELOAD CACHE
NOTIFY pgrst, 'reload schema';