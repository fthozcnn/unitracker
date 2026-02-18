-- Social Reactions: Nudge & Cheer
-- Run this in Supabase SQL Editor

-- Allow users to insert notifications (needed for reactions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert notifications' AND tablename = 'notifications'
    ) THEN
        CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT
          WITH CHECK (true);
    END IF;
END $$;

-- Allow users to delete their own notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own notifications' AND tablename = 'notifications'
    ) THEN
        CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- RPC: Send social reaction (nudge or cheer)
CREATE OR REPLACE FUNCTION send_social_reaction(
  target_user_id UUID,
  reaction_type TEXT
)
RETURNS JSON AS $$
DECLARE
  sender_name TEXT;
  friendship_exists BOOLEAN;
  recent_reaction_exists BOOLEAN;
  reaction_title TEXT;
  reaction_message TEXT;
  reaction_emoji TEXT;
BEGIN
  -- Validate reaction type
  IF reaction_type NOT IN ('nudge', 'cheer') THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tepki türü.');
  END IF;

  -- Check if they are friends
  SELECT EXISTS(
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (user_id = auth.uid() AND friend_id = target_user_id)
      OR (user_id = target_user_id AND friend_id = auth.uid())
    )
  ) INTO friendship_exists;

  IF NOT friendship_exists THEN
    RETURN json_build_object('success', false, 'error', 'Bu kullanıcıyla arkadaş değilsiniz.');
  END IF;

  -- Spam protection: 1 minute cooldown per reaction type per target
  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = target_user_id
    AND type = reaction_type
    AND created_at > NOW() - INTERVAL '1 minute'
    AND message LIKE '%' || (SELECT display_name FROM profiles WHERE id = auth.uid()) || '%'
  ) INTO recent_reaction_exists;

  IF recent_reaction_exists THEN
    RETURN json_build_object('success', false, 'error', 'Çok sık tepki gönderemezsiniz. Lütfen biraz bekleyin.');
  END IF;

  -- Get sender's display name
  SELECT COALESCE(display_name, email) INTO sender_name
  FROM profiles WHERE id = auth.uid();

  -- Build notification content
  IF reaction_type = 'nudge' THEN
    reaction_title := '👊 Dürtme!';
    reaction_message := sender_name || ' seni dürttü! Hadi çalışmaya başla!';
  ELSE
    reaction_title := '🎉 Tebrikler!';
    reaction_message := sender_name || ' seni tebrik etti! Harika gidiyorsun!';
  END IF;

  -- Insert notification
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (target_user_id, reaction_type, reaction_title, reaction_message, '/social');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
