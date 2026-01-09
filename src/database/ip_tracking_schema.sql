-- Add IP and country tracking columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS last_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create table to track all user sessions with IP/country
CREATE TABLE IF NOT EXISTS user_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  ip_address VARCHAR(45) NOT NULL,
  country VARCHAR(100),
  city VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_log_user ON user_sessions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_log_created ON user_sessions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_log_ip ON user_sessions_log(ip_address);

-- Add IP tracking to analytics events
ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS country VARCHAR(100);

COMMENT ON COLUMN users.ip_address IS 'IP address from first registration';
COMMENT ON COLUMN users.country IS 'Country from first registration';
COMMENT ON COLUMN users.last_ip_address IS 'Most recent IP address';
COMMENT ON COLUMN users.last_country IS 'Most recent country';
COMMENT ON TABLE user_sessions_log IS 'Log of all user sessions with IP and location data';
