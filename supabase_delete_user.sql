-- Function to delete a user's own account
-- Must be SECURITY DEFINER to bypass RLS and access auth.users
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Get the ID of the user making the request
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Delete the user from auth.users
    -- Due to ON DELETE CASCADE on foreign keys, this will also 
    -- delete the user's profile, courses, sessions, etc.
    DELETE FROM auth.users WHERE id = current_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
