-- Create a test session for ICA testing
-- This session token matches what the frontend typically generates

INSERT INTO user_sessions (
  id,
  session_token,
  ip_address,
  user_agent,
  created_at,
  expires_at,
  is_active
) VALUES (
  uuid_generate_v4(),
  'sess_test_ica_12345',  -- Use this session token in your frontend
  '127.0.0.1',
  'Test Browser',
  NOW(),
  NOW() + INTERVAL '7 days',
  true
)
ON CONFLICT (session_token) DO UPDATE
SET expires_at = NOW() + INTERVAL '7 days',
    is_active = true
RETURNING id, session_token, expires_at;
