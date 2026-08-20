-- ============================================================
-- F16: Atomic XP increment RPC
-- Run this in Supabase SQL Editor to enable race-condition-free XP updates.
-- If this RPC is not present, the client code falls back to read-then-write.
-- ============================================================

CREATE OR REPLACE FUNCTION add_user_xp(uid UUID, xp_amount INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_xp    INT;
    v_old_level INT;
    v_new_xp    INT;
    v_new_level INT;
    v_leveled   BOOLEAN;
BEGIN
    -- Atomic increment
    UPDATE profiles
    SET total_xp = COALESCE(total_xp, 0) + xp_amount,
        level    = GREATEST(1, FLOOR(SQRT((COALESCE(total_xp, 0) + xp_amount) / 100.0))::INT)
    WHERE id = uid
    RETURNING total_xp, level INTO v_new_xp, v_new_level;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_old_xp    := v_new_xp - xp_amount;
    v_old_level := GREATEST(1, FLOOR(SQRT(v_old_xp / 100.0))::INT);
    v_leveled   := v_new_level > v_old_level;

    RETURN json_build_object(
        'new_xp',    v_new_xp,
        'new_level', v_new_level,
        'leveled_up', v_leveled
    );
END;
$$;
