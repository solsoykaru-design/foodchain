-- Add app_settings column for per-application access control and limits
ALTER TABLE tenants ADD COLUMN app_settings TEXT DEFAULT '{"guest":{"enabled":true,"limit":-1},"courier":{"enabled":true,"limit":5},"waiter":{"enabled":true,"limit":8},"kitchen":{"enabled":true,"limit":3},"manager":{"enabled":true,"limit":10}}';
