-- Migration 011: assistant sales and reversible proposals
-- Dependencies: 010_add_inventory_assistant.sql.
-- Compatibility: apply before deploying code that selects reverts_proposal_id.
-- This migration is additive except for replacing the existing bounded
-- apply_assistant_proposal function with a backwards-compatible extension.
-- Local verification: 2026-08-31, parsed as SQL and PL/pgSQL and exercised in
-- isolated PGlite with an exact sale followed by its captured-state undo.
-- Production dry run: 2026-08-31, all 7 statements succeeded and rolled back.
-- Production applied: 2026-08-31, all 7 statements committed. Post-apply
-- verification passed for the column, foreign key, index, function security,
-- fixed search path, and role grants.

ALTER TABLE assistant_proposals
    ADD COLUMN IF NOT EXISTS reverts_proposal_id UUID
        REFERENCES assistant_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_proposals_reverts
    ON assistant_proposals(reverts_proposal_id)
    WHERE reverts_proposal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION apply_assistant_proposal(p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
    p assistant_proposals%ROWTYPE;
    original_proposal assistant_proposals%ROWTYPE;
    change JSONB;
    original_change JSONB;
    original_patch JSONB;
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
    final_sold BOOLEAN;
    final_settled BOOLEAN;
    final_checked BOOLEAN;
    final_distributor INTEGER;
    final_price NUMERIC;
    final_sale_date DATE;
    final_commission NUMERIC;
    location_commission NUMERIC;
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

    -- Parse and validate the complete proposal before changing any edition.
    -- Any error is converted to a stale proposal rather than a partial write.
    BEGIN
        IF jsonb_typeof(p.compiled_changes) <> 'array'
           OR jsonb_array_length(p.compiled_changes) = 0
           OR jsonb_array_length(p.compiled_changes) > 100 THEN
            RAISE EXCEPTION 'compiled_changes must contain 1 to 100 items';
        END IF;

        IF p.reverts_proposal_id IS NOT NULL THEN
            SELECT * INTO original_proposal FROM assistant_proposals
            WHERE id = p.reverts_proposal_id
              AND user_id = auth.uid()
              AND status = 'applied'
            FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'The original proposal is not available to undo';
            END IF;
            IF original_proposal.reverts_proposal_id IS NOT NULL THEN
                RAISE EXCEPTION 'An undo proposal cannot itself be undone automatically';
            END IF;
            IF original_proposal.result ? 'undone_by_proposal_id' THEN
                RAISE EXCEPTION 'The original proposal has already been undone';
            END IF;
            IF jsonb_typeof(original_proposal.compiled_changes) <> 'array'
               OR jsonb_array_length(original_proposal.compiled_changes)
                    <> jsonb_array_length(p.compiled_changes) THEN
                RAISE EXCEPTION 'Undo must cover every change in the original proposal';
            END IF;
        END IF;

        SELECT array_agg((item->>'edition_id')::INTEGER ORDER BY (item->>'edition_id')::INTEGER)
        INTO edition_ids FROM jsonb_array_elements(p.compiled_changes) item
        WHERE jsonb_typeof(item) = 'object'
          AND jsonb_typeof(item->'edition_id') = 'number'
          AND item->>'edition_id' ~ '^[0-9]+$';
        IF cardinality(edition_ids) <> jsonb_array_length(p.compiled_changes)
           OR cardinality(edition_ids) <> (SELECT count(DISTINCT x) FROM unnest(edition_ids) x) THEN
            RAISE EXCEPTION 'Every change needs a unique integer edition_id';
        END IF;

        PERFORM id FROM editions WHERE id = ANY(edition_ids) ORDER BY id FOR UPDATE;
        IF (SELECT count(*) FROM editions WHERE id = ANY(edition_ids)) <> cardinality(edition_ids) THEN
            RAISE EXCEPTION 'One or more target editions do not exist';
        END IF;

        FOR change IN
            SELECT value FROM jsonb_array_elements(p.compiled_changes)
            ORDER BY (value->>'edition_id')::INTEGER
        LOOP
            eid := (change->>'edition_id')::INTEGER;
            patch := change->'patch';
            IF COALESCE(jsonb_typeof(patch) <> 'object', true) OR patch = '{}'::jsonb
               OR EXISTS (
                   SELECT 1 FROM jsonb_object_keys(patch) AS field(key)
                   WHERE key NOT IN (
                       'is_printed', 'is_sold', 'is_settled', 'retail_price',
                       'date_sold', 'commission_percentage', 'distributor_id',
                       'date_in_gallery', 'is_stock_checked'
                   )
               )
               OR COALESCE(change->>'action' NOT IN ('update', 'move', 'sell', 'undo'), true)
               OR COALESCE(jsonb_typeof(change->'expected_updated_at') <> 'string', true) THEN
                RAISE EXCEPTION 'Malformed change for edition %', eid;
            END IF;
            IF (change->>'action' = 'undo') IS DISTINCT FROM (p.reverts_proposal_id IS NOT NULL) THEN
                RAISE EXCEPTION 'Undo metadata is inconsistent for edition %', eid;
            END IF;
            IF change->>'action' = 'sell'
               AND NOT (patch ? 'is_sold'
                        AND jsonb_typeof(patch->'is_sold') = 'boolean'
                        AND (patch->>'is_sold')::BOOLEAN IS TRUE) THEN
                RAISE EXCEPTION 'A sale change must mark edition % as sold', eid;
            END IF;
            IF change->>'action' <> 'sell'
               AND patch ? 'is_sold'
               AND jsonb_typeof(patch->'is_sold') = 'boolean'
               AND (patch->>'is_sold')::BOOLEAN IS TRUE THEN
                RAISE EXCEPTION 'Only a sale change can mark edition % as sold', eid;
            END IF;

            expected_at := (change->>'expected_updated_at')::TIMESTAMPTZ;
            SELECT * INTO before_row FROM editions WHERE id = eid;
            IF before_row.is_active IS NOT TRUE
               OR before_row.status_confidence = 'legacy_unknown'
               OR before_row.updated_at IS DISTINCT FROM expected_at
               OR (
                   before_row.is_sold IS TRUE
                   AND NOT (
                       change->>'action' = 'undo'
                       AND patch ? 'is_sold'
                       AND jsonb_typeof(patch->'is_sold') = 'boolean'
                       AND (patch->>'is_sold')::BOOLEAN IS FALSE
                   )
               ) THEN
                RAISE EXCEPTION 'Edition % is no longer eligible or has changed', eid;
            END IF;

            -- New proposals capture exact before-values for safe undo. Keep
            -- compatibility with pending migration-010 proposals that have no
            -- before object, but reject a malformed snapshot when one exists.
            IF change ? 'before' AND (
                jsonb_typeof(change->'before') <> 'object'
                OR EXISTS (
                    SELECT 1 FROM jsonb_object_keys(patch) AS patch_fields(field_key)
                    WHERE NOT (change->'before' ? patch_fields.field_key)
                )
                OR EXISTS (
                    SELECT 1 FROM jsonb_object_keys(change->'before') AS before_fields(field_key)
                    WHERE NOT (patch ? before_fields.field_key)
                )
                OR EXISTS (
                    SELECT 1 FROM jsonb_object_keys(change->'before') AS before_fields(field_key)
                    WHERE (
                        CASE WHEN before_fields.field_key IN (
                            'is_printed', 'is_sold', 'is_settled', 'is_stock_checked'
                        ) THEN to_jsonb(COALESCE(
                            (to_jsonb(before_row) ->> before_fields.field_key)::BOOLEAN,
                            false
                        )) ELSE to_jsonb(before_row) -> before_fields.field_key END
                    ) IS DISTINCT FROM (change->'before' -> before_fields.field_key)
                )
            ) THEN
                RAISE EXCEPTION 'Before-values do not match edition %', eid;
            END IF;

            IF p.reverts_proposal_id IS NOT NULL THEN
                original_change := NULL;
                SELECT value INTO original_change
                FROM jsonb_array_elements(original_proposal.compiled_changes)
                WHERE (value->>'edition_id')::INTEGER = eid;
                IF original_change IS NULL
                   OR jsonb_typeof(original_change->'before') <> 'object'
                   OR jsonb_typeof(original_change->'patch') <> 'object'
                   OR patch IS DISTINCT FROM original_change->'before' THEN
                    RAISE EXCEPTION 'Undo snapshot does not match the original change for edition %', eid;
                END IF;
                original_patch := original_change->'patch';
                IF EXISTS (
                    SELECT 1 FROM jsonb_object_keys(original_patch) AS fields(field_key)
                    WHERE (
                        CASE WHEN fields.field_key IN (
                            'is_printed', 'is_sold', 'is_settled', 'is_stock_checked'
                        ) THEN to_jsonb(COALESCE(
                            (to_jsonb(before_row) ->> fields.field_key)::BOOLEAN,
                            false
                        )) ELSE to_jsonb(before_row) -> fields.field_key END
                    )
                        IS DISTINCT FROM (original_patch -> fields.field_key)
                ) THEN
                    RAISE EXCEPTION 'Edition % changed after the original proposal', eid;
                END IF;
            END IF;

            IF patch ? 'is_printed' AND jsonb_typeof(patch->'is_printed') <> 'boolean'
               OR patch ? 'is_sold' AND jsonb_typeof(patch->'is_sold') <> 'boolean'
               OR patch ? 'is_settled' AND jsonb_typeof(patch->'is_settled') <> 'boolean'
               OR patch ? 'is_stock_checked' AND jsonb_typeof(patch->'is_stock_checked') <> 'boolean'
               OR patch ? 'retail_price' AND jsonb_typeof(patch->'retail_price') NOT IN ('number', 'null')
               OR patch ? 'commission_percentage' AND jsonb_typeof(patch->'commission_percentage') NOT IN ('number', 'null')
               OR patch ? 'date_sold' AND jsonb_typeof(patch->'date_sold') NOT IN ('string', 'null')
               OR patch ? 'date_in_gallery' AND jsonb_typeof(patch->'date_in_gallery') NOT IN ('string', 'null')
               OR patch ? 'distributor_id' AND jsonb_typeof(patch->'distributor_id') NOT IN ('number', 'null') THEN
                RAISE EXCEPTION 'Invalid patch value for edition %', eid;
            END IF;

            IF patch ? 'date_sold' AND patch->'date_sold' <> 'null'::jsonb THEN
                IF patch->>'date_sold' !~ '^\d{4}-\d{2}-\d{2}$' THEN
                    RAISE EXCEPTION 'Invalid sale date for edition %', eid;
                END IF;
                PERFORM (patch->>'date_sold')::DATE;
            END IF;
            IF patch ? 'date_in_gallery' AND patch->'date_in_gallery' <> 'null'::jsonb THEN
                IF patch->>'date_in_gallery' !~ '^\d{4}-\d{2}-\d{2}$' THEN
                    RAISE EXCEPTION 'Invalid gallery date for edition %', eid;
                END IF;
                PERFORM (patch->>'date_in_gallery')::DATE;
            END IF;
            IF patch ? 'distributor_id' AND patch->'distributor_id' <> 'null'::jsonb
               AND patch->>'distributor_id' !~ '^[0-9]+$' THEN
                RAISE EXCEPTION 'Invalid location ID for edition %', eid;
            END IF;
            IF patch ? 'retail_price' AND patch->'retail_price' <> 'null'::jsonb THEN
                final_price := (patch->>'retail_price')::NUMERIC;
                IF final_price < 0 OR final_price > 99999999.99
                   OR final_price <> round(final_price, 2) THEN
                    RAISE EXCEPTION 'Invalid sale price for edition %', eid;
                END IF;
            END IF;
            IF patch ? 'commission_percentage' AND patch->'commission_percentage' <> 'null'::jsonb THEN
                final_commission := (patch->>'commission_percentage')::NUMERIC;
                IF final_commission < 0 OR final_commission > 100 THEN
                    RAISE EXCEPTION 'Invalid commission for edition %', eid;
                END IF;
            END IF;

            final_printed := CASE WHEN patch ? 'is_printed'
                THEN (patch->>'is_printed')::BOOLEAN ELSE before_row.is_printed END;
            final_sold := CASE WHEN patch ? 'is_sold'
                THEN (patch->>'is_sold')::BOOLEAN ELSE before_row.is_sold END;
            final_settled := CASE WHEN patch ? 'is_settled'
                THEN (patch->>'is_settled')::BOOLEAN ELSE before_row.is_settled END;
            final_checked := CASE WHEN patch ? 'is_stock_checked'
                THEN (patch->>'is_stock_checked')::BOOLEAN ELSE before_row.is_stock_checked END;
            final_distributor := CASE WHEN patch ? 'distributor_id'
                THEN CASE WHEN patch->'distributor_id' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'distributor_id')::INTEGER END
                ELSE before_row.distributor_id END;
            final_price := CASE WHEN patch ? 'retail_price'
                THEN CASE WHEN patch->'retail_price' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'retail_price')::NUMERIC END
                ELSE before_row.retail_price END;
            final_sale_date := CASE WHEN patch ? 'date_sold'
                THEN CASE WHEN patch->'date_sold' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'date_sold')::DATE END
                ELSE before_row.date_sold END;
            final_commission := CASE WHEN patch ? 'commission_percentage'
                THEN CASE WHEN patch->'commission_percentage' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'commission_percentage')::NUMERIC END
                ELSE before_row.commission_percentage END;

            IF patch ? 'distributor_id' AND final_distributor IS NOT NULL THEN
                destination_id := final_distributor;
                IF NOT EXISTS (
                    SELECT 1 FROM distributors
                    WHERE id = destination_id AND is_active IS TRUE
                ) THEN
                    RAISE EXCEPTION 'Destination for edition % is missing or inactive', eid;
                END IF;
            END IF;
            IF final_distributor IS NOT NULL AND final_printed IS NOT TRUE THEN
                RAISE EXCEPTION 'An unprinted edition cannot have a location';
            END IF;
            IF final_checked IS TRUE AND (
                final_printed IS NOT TRUE OR final_sold IS TRUE OR final_distributor IS NULL
            ) THEN
                RAISE EXCEPTION 'A checked edition must be printed, unsold, and located';
            END IF;
            IF final_settled IS TRUE AND final_sold IS NOT TRUE THEN
                RAISE EXCEPTION 'Only a sold edition can be settled';
            END IF;
            IF final_sold IS TRUE AND final_printed IS NOT TRUE THEN
                RAISE EXCEPTION 'A sold edition must be printed';
            END IF;
            IF final_sold IS TRUE AND (final_price IS NULL OR final_sale_date IS NULL) THEN
                RAISE EXCEPTION 'A sold edition needs an exact price and sale date';
            END IF;
            IF final_commission IS NOT NULL
               AND (final_commission < 0 OR final_commission > 100) THEN
                RAISE EXCEPTION 'Invalid final commission for edition %', eid;
            END IF;
            IF change->>'action' = 'sell' THEN
                IF before_row.is_printed IS NOT TRUE THEN
                    RAISE EXCEPTION 'Edition % must already be printed before sale', eid;
                END IF;
                IF patch ? 'is_printed' OR patch ? 'distributor_id' OR patch ? 'date_in_gallery' THEN
                    RAISE EXCEPTION 'A sale must keep the printed and location state for edition %', eid;
                END IF;
                IF final_settled IS TRUE OR final_checked IS TRUE THEN
                    RAISE EXCEPTION 'A sale must start unsettled and clear stock confirmation';
                END IF;
                location_commission := NULL;
                IF final_distributor IS NOT NULL THEN
                    SELECT commission_percentage INTO location_commission
                    FROM distributors WHERE id = final_distributor;
                END IF;
                IF final_commission IS DISTINCT FROM location_commission THEN
                    RAISE EXCEPTION 'Sale commission no longer matches the recorded location for edition %', eid;
                END IF;
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
    FOR change IN
        SELECT value FROM jsonb_array_elements(p.compiled_changes)
        ORDER BY (value->>'edition_id')::INTEGER
    LOOP
        eid := (change->>'edition_id')::INTEGER;
        patch := change->'patch';
        safe_description := left(COALESCE(change->>'description', ''), 500);
        SELECT * INTO before_row FROM editions WHERE id = eid;
        UPDATE editions SET
            is_printed = CASE WHEN patch ? 'is_printed'
                THEN (patch->>'is_printed')::BOOLEAN ELSE is_printed END,
            is_sold = CASE WHEN patch ? 'is_sold'
                THEN (patch->>'is_sold')::BOOLEAN ELSE is_sold END,
            is_settled = CASE WHEN patch ? 'is_settled'
                THEN (patch->>'is_settled')::BOOLEAN ELSE is_settled END,
            retail_price = CASE WHEN patch ? 'retail_price'
                THEN CASE WHEN patch->'retail_price' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'retail_price')::NUMERIC END
                ELSE retail_price END,
            date_sold = CASE WHEN patch ? 'date_sold'
                THEN CASE WHEN patch->'date_sold' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'date_sold')::DATE END
                ELSE date_sold END,
            commission_percentage = CASE WHEN patch ? 'commission_percentage'
                THEN CASE WHEN patch->'commission_percentage' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'commission_percentage')::NUMERIC END
                ELSE commission_percentage END,
            distributor_id = CASE WHEN patch ? 'distributor_id'
                THEN CASE WHEN patch->'distributor_id' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'distributor_id')::INTEGER END
                ELSE distributor_id END,
            date_in_gallery = CASE WHEN patch ? 'date_in_gallery'
                THEN CASE WHEN patch->'date_in_gallery' = 'null'::jsonb
                    THEN NULL ELSE (patch->>'date_in_gallery')::DATE END
                ELSE date_in_gallery END,
            is_stock_checked = CASE WHEN patch ? 'is_stock_checked'
                THEN (patch->>'is_stock_checked')::BOOLEAN ELSE is_stock_checked END,
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
        IF before_row.is_sold IS DISTINCT FROM after_row.is_sold THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'is_sold',before_row.is_sold::TEXT,after_row.is_sold::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.is_settled IS DISTINCT FROM after_row.is_settled THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'is_settled',before_row.is_settled::TEXT,after_row.is_settled::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.retail_price IS DISTINCT FROM after_row.retail_price THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'retail_price',before_row.retail_price::TEXT,after_row.retail_price::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.date_sold IS DISTINCT FROM after_row.date_sold THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'date_sold',before_row.date_sold::TEXT,after_row.date_sold::TEXT,safe_description,p.id,'assistant');
        END IF;
        IF before_row.commission_percentage IS DISTINCT FROM after_row.commission_percentage THEN
            INSERT INTO activity_log(user_id,user_email,action,entity_type,entity_id,entity_name,field_name,old_value,new_value,description,proposal_id,source)
            VALUES(auth.uid(),jwt_email,change->>'action','edition',eid,after_row.edition_display_name,'commission_percentage',before_row.commission_percentage::TEXT,after_row.commission_percentage::TEXT,safe_description,p.id,'assistant');
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

    response := jsonb_build_object(
        'ok', true,
        'status', 'applied',
        'proposal_id', p.id,
        'edition_count', changed_count,
        'reverts_proposal_id', p.reverts_proposal_id
    );
    UPDATE assistant_proposals SET status = 'applied', applied_at = now(),
        updated_at = now(), result = response WHERE id = p.id;

    IF p.reverts_proposal_id IS NOT NULL THEN
        UPDATE assistant_proposals
        SET result = COALESCE(result, '{}'::jsonb)
                || jsonb_build_object('undone_by_proposal_id', p.id),
            updated_at = now()
        WHERE id = p.reverts_proposal_id AND user_id = auth.uid();
    END IF;
    RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION apply_assistant_proposal(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_assistant_proposal(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION apply_assistant_proposal(UUID) TO authenticated;

COMMENT ON FUNCTION apply_assistant_proposal(UUID) IS
'Atomically validates and applies authenticated inventory proposals, including exact sales and captured-state undo.';
