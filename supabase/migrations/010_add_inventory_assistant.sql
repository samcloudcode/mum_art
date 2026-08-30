-- Migration 010: bounded inventory-assistant proposals
-- Dependencies: 001 (inventory/authenticated RLS), 002 (status_confidence),
-- 003_add_activity_log, and 005 (edition_type; application may display it).
-- Compatibility: additive; the currently deployed application may continue to
-- use inventory and activity_log without knowing about assistant proposals.
-- Production dry run: 2026-08-30, all 26 statements succeeded and were rolled
-- back; a post-rollback check confirmed that no assistant objects persisted.
-- Production applied: 2026-08-30, all 26 statements committed. Post-apply
-- verification passed for RLS, policies, grants, function security and columns;
-- all three assistant tables began empty.

-- The historical short-name migration is not known to be applied everywhere.
-- The assistant uses these abbreviations to resolve handwritten inventory, so
-- reconcile this additive column without requiring an unsafe migration replay.
ALTER TABLE prints ADD COLUMN IF NOT EXISTS short_name VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_prints_short_name ON prints(short_name);

CREATE TABLE assistant_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applied', 'rejected', 'superseded', 'expired', 'stale')),
    request_text TEXT NOT NULL,
    requested_actions JSONB NOT NULL,
    compiled_changes JSONB NOT NULL,
    preview JSONB NOT NULL,
    model TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
    applied_at TIMESTAMPTZ,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conversations_user_created
    ON assistant_conversations(user_id, created_at DESC);
CREATE INDEX idx_assistant_messages_conversation_created
    ON assistant_messages(conversation_id, created_at);
CREATE INDEX idx_assistant_messages_user ON assistant_messages(user_id);
CREATE INDEX idx_assistant_proposals_user_status
    ON assistant_proposals(user_id, status, created_at DESC);
CREATE INDEX idx_assistant_proposals_conversation
    ON assistant_proposals(conversation_id, created_at DESC);
CREATE INDEX idx_assistant_proposals_pending_expiry
    ON assistant_proposals(expires_at) WHERE status = 'pending';

CREATE TRIGGER update_assistant_conversations_updated_at
    BEFORE UPDATE ON assistant_conversations FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assistant_proposals_updated_at
    BEFORE UPDATE ON assistant_proposals FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their assistant conversations"
    ON assistant_conversations FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their assistant messages"
    ON assistant_messages FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their assistant proposals"
    ON assistant_proposals FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE activity_log
    ADD COLUMN proposal_id UUID REFERENCES assistant_proposals(id) ON DELETE SET NULL,
    ADD COLUMN source TEXT NOT NULL DEFAULT 'app'
        CHECK (source IN ('app', 'assistant'));
CREATE INDEX idx_activity_log_proposal_id ON activity_log(proposal_id);

CREATE OR REPLACE FUNCTION apply_assistant_proposal(p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
    p assistant_proposals%ROWTYPE;
    change JSONB;
    patch JSONB;
    before_row editions%ROWTYPE;
    after_row editions%ROWTYPE;
    edition_ids INTEGER[];
    eid INTEGER;
    expected_at TIMESTAMPTZ;
    destination_id INTEGER;
    destination_name TEXT;
    old_location_name TEXT;
    final_printed BOOLEAN;
    final_checked BOOLEAN;
    final_distributor INTEGER;
    safe_description TEXT;
    jwt_email TEXT;
    changed_count INTEGER := 0;
    response JSONB;
    invalid_message TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO p FROM assistant_proposals
    WHERE id = p_proposal_id AND user_id = auth.uid()
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'proposal not found' USING ERRCODE = 'P0002';
    END IF;

    IF p.status = 'applied' THEN
        RETURN COALESCE(p.result, jsonb_build_object(
            'ok', true, 'status', 'applied', 'proposal_id', p.id));
    END IF;
    IF p.status <> 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'status', p.status,
                                  'message', 'Proposal is not pending');
    END IF;
    IF p.expires_at <= now() THEN
        response := jsonb_build_object('ok', false, 'status', 'expired',
                                       'message', 'Proposal has expired');
        UPDATE assistant_proposals SET status = 'expired', result = response,
            updated_at = now() WHERE id = p.id;
        RETURN response;
    END IF;

    -- Parse only data values. Cast failures are caught and made safely stale.
    BEGIN
        IF jsonb_typeof(p.compiled_changes) <> 'array'
           OR jsonb_array_length(p.compiled_changes) = 0
           OR jsonb_array_length(p.compiled_changes) > 100 THEN
            RAISE EXCEPTION 'compiled_changes must contain 1 to 100 items';
        END IF;

        SELECT array_agg((item->>'edition_id')::INTEGER ORDER BY (item->>'edition_id')::INTEGER)
        INTO edition_ids FROM jsonb_array_elements(p.compiled_changes) item
        WHERE jsonb_typeof(item) = 'object'
          AND jsonb_typeof(item->'edition_id') = 'number';
        IF cardinality(edition_ids) <> jsonb_array_length(p.compiled_changes)
           OR cardinality(edition_ids) <> (SELECT count(DISTINCT x) FROM unnest(edition_ids) x) THEN
            RAISE EXCEPTION 'Every change needs a unique integer edition_id';
        END IF;

        -- Acquire every target lock in deterministic order before validation.
        PERFORM id FROM editions WHERE id = ANY(edition_ids) ORDER BY id FOR UPDATE;
        IF (SELECT count(*) FROM editions WHERE id = ANY(edition_ids)) <> cardinality(edition_ids) THEN
            RAISE EXCEPTION 'One or more target editions do not exist';
        END IF;

        -- First pass: validate the complete batch before any inventory UPDATE.
        FOR change IN SELECT value FROM jsonb_array_elements(p.compiled_changes) ORDER BY (value->>'edition_id')::INTEGER
        LOOP
            eid := (change->>'edition_id')::INTEGER;
            patch := change->'patch';
            IF COALESCE(jsonb_typeof(patch) <> 'object', true) OR patch = '{}'::jsonb
               OR EXISTS (SELECT 1 FROM jsonb_object_keys(patch) AS field(key)
                          WHERE key NOT IN ('is_printed','distributor_id','date_in_gallery','is_stock_checked'))
               OR COALESCE(change->>'action' NOT IN ('update', 'move'), true)
               OR COALESCE(jsonb_typeof(change->'expected_updated_at') <> 'string', true) THEN
                RAISE EXCEPTION 'Malformed change for edition %', eid;
            END IF;
            expected_at := (change->>'expected_updated_at')::TIMESTAMPTZ;
            SELECT * INTO before_row FROM editions WHERE id = eid;
            IF before_row.is_active IS NOT TRUE OR before_row.status_confidence = 'legacy_unknown'
               OR before_row.is_sold IS NOT FALSE OR before_row.updated_at IS DISTINCT FROM expected_at THEN
                RAISE EXCEPTION 'Edition % is no longer eligible or has changed', eid;
            END IF;
            IF patch ? 'is_printed' AND jsonb_typeof(patch->'is_printed') <> 'boolean'
               OR patch ? 'is_stock_checked' AND jsonb_typeof(patch->'is_stock_checked') <> 'boolean'
               OR patch ? 'date_in_gallery' AND jsonb_typeof(patch->'date_in_gallery') NOT IN ('string','null')
               OR patch ? 'distributor_id' AND jsonb_typeof(patch->'distributor_id') <> 'number' THEN
                RAISE EXCEPTION 'Invalid patch value for edition %', eid;
            END IF;
            IF patch ? 'date_in_gallery' AND patch->'date_in_gallery' <> 'null'::jsonb THEN
                PERFORM (patch->>'date_in_gallery')::DATE;
            END IF;
            final_printed := CASE WHEN patch ? 'is_printed' THEN (patch->>'is_printed')::BOOLEAN ELSE before_row.is_printed END;
            final_checked := CASE WHEN patch ? 'is_stock_checked' THEN (patch->>'is_stock_checked')::BOOLEAN ELSE before_row.is_stock_checked END;
            final_distributor := CASE WHEN patch ? 'distributor_id' THEN (patch->>'distributor_id')::INTEGER ELSE before_row.distributor_id END;
            IF patch ? 'distributor_id' THEN
                destination_id := (patch->>'distributor_id')::INTEGER;
                IF NOT EXISTS (SELECT 1 FROM distributors WHERE id = destination_id AND is_active IS TRUE) THEN
                    RAISE EXCEPTION 'Destination for edition % is missing or inactive', eid;
                END IF;
            END IF;
            IF final_distributor IS NOT NULL AND final_printed IS NOT TRUE THEN
                RAISE EXCEPTION 'An unprinted edition cannot have a location';
            END IF;
            IF final_checked IS TRUE AND (final_printed IS NOT TRUE OR final_distributor IS NULL) THEN
                RAISE EXCEPTION 'A checked edition must be printed, unsold, and located';
            END IF;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        invalid_message := left(SQLERRM, 240);
    END;

    IF invalid_message IS NOT NULL THEN
        response := jsonb_build_object('ok', false, 'status', 'stale',
                                       'message', invalid_message);
        UPDATE assistant_proposals SET status = 'stale', result = response,
            updated_at = now() WHERE id = p.id;
        RETURN response;
    END IF;

    jwt_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
    -- Second pass: exact whitelisted assignments, followed by derived audit rows.
    FOR change IN SELECT value FROM jsonb_array_elements(p.compiled_changes) ORDER BY (value->>'edition_id')::INTEGER
    LOOP
        eid := (change->>'edition_id')::INTEGER;
        patch := change->'patch';
        safe_description := left(COALESCE(change->>'description', ''), 500);
        SELECT * INTO before_row FROM editions WHERE id = eid;
        UPDATE editions SET
            is_printed = CASE WHEN patch ? 'is_printed' THEN (patch->>'is_printed')::BOOLEAN ELSE is_printed END,
            distributor_id = CASE WHEN patch ? 'distributor_id' THEN (patch->>'distributor_id')::INTEGER ELSE distributor_id END,
            date_in_gallery = CASE WHEN patch ? 'date_in_gallery' THEN (patch->>'date_in_gallery')::DATE ELSE date_in_gallery END,
            is_stock_checked = CASE WHEN patch ? 'is_stock_checked' THEN (patch->>'is_stock_checked')::BOOLEAN ELSE is_stock_checked END,
            updated_at = now()
        WHERE id = eid RETURNING * INTO after_row;

        SELECT name INTO old_location_name FROM distributors WHERE id = before_row.distributor_id;
        SELECT name INTO destination_name FROM distributors WHERE id = after_row.distributor_id;
        old_location_name := COALESCE(old_location_name, 'unassigned');
        destination_name := COALESCE(destination_name, 'unassigned');
        IF before_row.is_printed IS DISTINCT FROM after_row.is_printed THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'is_printed',before_row.is_printed::TEXT,after_row.is_printed::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.distributor_id IS DISTINCT FROM after_row.distributor_id THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,related_entity_type,related_entity_id,related_entity_name,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'location',old_location_name,destination_name,safe_description,'distributor',after_row.distributor_id,destination_name,p.id,'assistant');
        END IF;
        IF before_row.date_in_gallery IS DISTINCT FROM after_row.date_in_gallery THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'date_in_gallery',before_row.date_in_gallery::TEXT,after_row.date_in_gallery::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.is_stock_checked IS DISTINCT FROM after_row.is_stock_checked THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'is_stock_checked',before_row.is_stock_checked::TEXT,after_row.is_stock_checked::TEXT,safe_description,p.id,'assistant');
        END IF;
        changed_count := changed_count + 1;
    END LOOP;

    response := jsonb_build_object('ok', true, 'status', 'applied',
        'proposal_id', p.id, 'edition_count', changed_count);
    UPDATE assistant_proposals SET status = 'applied', applied_at = now(),
        updated_at = now(), result = response WHERE id = p.id;
    RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION apply_assistant_proposal(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_assistant_proposal(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION apply_assistant_proposal(UUID) TO authenticated;

COMMENT ON FUNCTION apply_assistant_proposal(UUID) IS
'Atomically validates and applies an authenticated user-owned, bounded inventory proposal.';
