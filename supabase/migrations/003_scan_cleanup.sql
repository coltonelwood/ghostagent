-- Auto-expire scans that have been stuck in pending/scanning/classifying for >10 minutes
-- Run this as a scheduled Supabase Edge Function cron, or call /api/internal/cleanup periodically

CREATE OR REPLACE FUNCTION cleanup_stuck_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE scans
  SET
    status = 'failed',
    error_message = 'Scan timed out after 10 minutes'
  WHERE
    status IN ('pending', 'scanning', 'classifying')
    AND started_at < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Allow service role to call it
GRANT EXECUTE ON FUNCTION cleanup_stuck_scans() TO service_role;

-- Optional: Supabase cron via pg_cron (enable pg_cron extension first)
-- SELECT cron.schedule('cleanup-stuck-scans', '*/10 * * * *', 'SELECT cleanup_stuck_scans()');
