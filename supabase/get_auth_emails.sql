-- Create a function to fetch emails for a list of user IDs
CREATE OR REPLACE FUNCTION get_auth_emails(user_ids uuid[])
RETURNS TABLE (id uuid, email varchar)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT result.id, result.email::varchar
  FROM auth.users as result
  WHERE result.id = ANY(user_ids);
END;
$$;
