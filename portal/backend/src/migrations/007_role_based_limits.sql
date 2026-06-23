-- Migrate app_settings from app-grouped format to per-role format
-- Old: {"courier":{"enabled":true,"limit":5},"waiter":{"enabled":true,"limit":8},"kitchen":{"enabled":true,"limit":3},"manager":{"enabled":true,"limit":10},"guest":{"enabled":true,"limit":-1}}
-- New: {"admin":-1,"waiter":8,"chef":-1,"kitchen":-1,"courier":5,"manager":-1,"stock_manager":-1,"guest":-1}

UPDATE tenants SET app_settings = (
  SELECT json_patch(
    '{}',
    json_object(
      'admin',
      CASE
        WHEN json_extract(app_settings, '$.manager.limit') IS NOT NULL AND json_extract(app_settings, '$.manager.enabled') = 1
        THEN json_extract(app_settings, '$.manager.limit')
        ELSE -1
      END,
      'waiter',
      CASE
        WHEN json_extract(app_settings, '$.waiter.limit') IS NOT NULL AND json_extract(app_settings, '$.waiter.enabled') = 1
        THEN json_extract(app_settings, '$.waiter.limit')
        ELSE -1
      END,
      'chef',
      CASE
        WHEN json_extract(app_settings, '$.kitchen.limit') IS NOT NULL AND json_extract(app_settings, '$.kitchen.enabled') = 1
        THEN json_extract(app_settings, '$.kitchen.limit')
        ELSE -1
      END,
      'kitchen',
      CASE
        WHEN json_extract(app_settings, '$.kitchen.limit') IS NOT NULL AND json_extract(app_settings, '$.kitchen.enabled') = 1
        THEN json_extract(app_settings, '$.kitchen.limit')
        ELSE -1
      END,
      'courier',
      CASE
        WHEN json_extract(app_settings, '$.courier.limit') IS NOT NULL AND json_extract(app_settings, '$.courier.enabled') = 1
        THEN json_extract(app_settings, '$.courier.limit')
        ELSE -1
      END,
      'manager',
      CASE
        WHEN json_extract(app_settings, '$.manager.limit') IS NOT NULL AND json_extract(app_settings, '$.manager.enabled') = 1
        THEN json_extract(app_settings, '$.manager.limit')
        ELSE -1
      END,
      'stock_manager',
      CASE
        WHEN json_extract(app_settings, '$.manager.limit') IS NOT NULL AND json_extract(app_settings, '$.manager.enabled') = 1
        THEN json_extract(app_settings, '$.manager.limit')
        ELSE -1
      END,
      'guest',
      CASE
        WHEN json_extract(app_settings, '$.guest.limit') IS NOT NULL AND json_extract(app_settings, '$.guest.enabled') = 1
        THEN json_extract(app_settings, '$.guest.limit')
        ELSE CASE
          WHEN json_extract(app_settings, '$.guest.enabled') = 0 THEN 0
          ELSE -1
        END
      END
    )
  )
  WHERE app_settings IS NOT NULL AND app_settings != ''
);

-- For rows where app_settings IS NULL or empty, set defaults
UPDATE tenants SET app_settings = '{"admin":-1,"waiter":-1,"chef":-1,"kitchen":-1,"courier":-1,"manager":-1,"stock_manager":-1,"guest":-1}'
WHERE app_settings IS NULL OR app_settings = '';
