-- Drop existing functions to avoid return type mismatch errors
DROP FUNCTION IF EXISTS get_leaderboard(TEXT);
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_leaderboard(timeframe TEXT DEFAULT 'weekly', scope TEXT DEFAULT 'friends')
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  total_minutes INTEGER,
  rank BIGINT
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  IF timeframe = 'weekly' THEN
    start_date := NOW() - INTERVAL '7 days';
  ELSE
    start_date := NOW() - INTERVAL '30 days';
  END IF;

  RETURN QUERY
  WITH relevant_users AS (
    SELECT f.friend_id as u_id FROM friendships f WHERE scope = 'friends' AND f.user_id = auth.uid() AND f.status = 'accepted'
    UNION
    SELECT f.user_id as u_id FROM friendships f WHERE scope = 'friends' AND f.friend_id = auth.uid() AND f.status = 'accepted'
    UNION
    SELECT auth.uid() as u_id WHERE scope = 'friends'
    UNION
    SELECT id as u_id FROM profiles WHERE scope = 'global'
  )
  SELECT 
    ru.u_id as user_id,
    COALESCE(p.display_name, 'İsimsiz Kullanıcı') as display_name,
    u.email as email,
    COALESCE(SUM(ss.duration / 60), 0)::INTEGER as total_minutes,
    RANK() OVER (ORDER BY COALESCE(SUM(ss.duration), 0) DESC) as rank
  FROM relevant_users ru
  LEFT JOIN profiles p ON ru.u_id = p.id
  LEFT JOIN auth.users u ON ru.u_id = u.id
  LEFT JOIN study_sessions ss ON ss.user_id = ru.u_id AND ss.start_time >= start_date
  GROUP BY ru.u_id, p.display_name, u.email
  ORDER BY total_minutes DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
