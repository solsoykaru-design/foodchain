-- Themes table
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT NULL,
  name TEXT NOT NULL,
  colors TEXT NOT NULL DEFAULT '{}',
  is_preset INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES foodchain_portal_tenants(id)
);

-- Add theme_id to users
ALTER TABLE users ADD COLUMN theme_id INTEGER DEFAULT NULL REFERENCES themes(id);

-- Add theme_id to staff (for admin panel)
ALTER TABLE staff ADD COLUMN theme_id INTEGER DEFAULT NULL REFERENCES themes(id);

-- Seed preset themes
INSERT OR IGNORE INTO themes (id, name, colors, is_preset, is_active) VALUES
(1, 'Светлая (классическая)', '{"bgPrimary":"#FFFFFF","bgSecondary":"#F1F5F9","textPrimary":"#1A1A1A","textSecondary":"#64748B","textHeading":"#0F172A","accent":"#2563EB","buttonPrimary":"#2563EB","cardBg":"#FFFFFF","border":"#E2E8F0","error":"#DC2626","success":"#16A34A","warning":"#D97706"}', 1, 1),
(2, 'Тёмная (ночная)', '{"bgPrimary":"#121212","bgSecondary":"#1E1E1E","textPrimary":"#FFFFFF","textSecondary":"#A1A1AA","textHeading":"#FAFAFA","accent":"#7C3AED","buttonPrimary":"#7C3AED","cardBg":"#1E1E1E","border":"#2D2D2D","error":"#EF4444","success":"#22C55E","warning":"#F59E0B"}', 1, 1),
(3, 'Солнечная', '{"bgPrimary":"#FFF8E7","bgSecondary":"#FFFAF0","textPrimary":"#4A3000","textSecondary":"#8B7355","textHeading":"#3B2200","accent":"#F59E0B","buttonPrimary":"#F59E0B","cardBg":"#FFFFFF","border":"#FDE68A","error":"#DC2626","success":"#16A34A","warning":"#D97706"}', 1, 1),
(4, 'Морская', '{"bgPrimary":"#F0F9FF","bgSecondary":"#E0F2FE","textPrimary":"#0C4A6E","textSecondary":"#0284C7","textHeading":"#082F49","accent":"#0EA5E9","buttonPrimary":"#0EA5E9","cardBg":"#FFFFFF","border":"#BAE6FD","error":"#E11D48","success":"#059669","warning":"#D97706"}', 1, 1),
(5, 'Лесная', '{"bgPrimary":"#F2F9F2","bgSecondary":"#E6F5E6","textPrimary":"#14532D","textSecondary":"#4A7C59","textHeading":"#0A3D1E","accent":"#22C55E","buttonPrimary":"#22C55E","cardBg":"#FFFFFF","border":"#BBF7D0","error":"#DC2626","success":"#16A34A","warning":"#CA8A04"}', 1, 1),
(6, 'Розовая', '{"bgPrimary":"#FFF1F2","bgSecondary":"#FFE4E6","textPrimary":"#831843","textSecondary":"#BE185D","textHeading":"#4C0519","accent":"#EC4899","buttonPrimary":"#EC4899","cardBg":"#FFFFFF","border":"#FBCFE8","error":"#E11D48","success":"#16A34A","warning":"#D97706"}', 1, 1),
(7, 'Космическая', '{"bgPrimary":"#0F172A","bgSecondary":"#1E293B","textPrimary":"#E2E8F0","textSecondary":"#94A3B8","textHeading":"#F8FAFC","accent":"#8B5CF6","buttonPrimary":"#8B5CF6","cardBg":"#1E293B","border":"#334155","error":"#EF4444","success":"#22C55E","warning":"#F59E0B"}', 1, 1),
(8, 'Минималистичная', '{"bgPrimary":"#F8FAFC","bgSecondary":"#F1F5F9","textPrimary":"#0F172A","textSecondary":"#64748B","textHeading":"#020617","accent":"#475569","buttonPrimary":"#475569","cardBg":"#FFFFFF","border":"#CBD5E1","error":"#DC2626","success":"#16A34A","warning":"#D97706"}', 1, 1),
(9, 'Контрастная', '{"bgPrimary":"#FFFFFF","bgSecondary":"#F5F5F5","textPrimary":"#000000","textSecondary":"#1A1A1A","textHeading":"#000000","accent":"#DC2626","buttonPrimary":"#DC2626","cardBg":"#FFFFFF","border":"#000000","error":"#B91C1C","success":"#15803D","warning":"#B45309"}', 1, 1),
(10, 'Винтажная', '{"bgPrimary":"#FEF3C7","bgSecondary":"#FDE68A","textPrimary":"#78350F","textSecondary":"#92400E","textHeading":"#451A03","accent":"#B45309","buttonPrimary":"#B45309","cardBg":"#FFFBEB","border":"#D97706","error":"#B91C1C","success":"#15803D","warning":"#A16207"}', 1, 1),
(11, 'Светлый брутальный', '{"bgPrimary":"#F5F5F5","bgSecondary":"#E5E5E5","textPrimary":"#1A1A1A","textSecondary":"#404040","textHeading":"#000000","accent":"#D32F2F","buttonPrimary":"#D32F2F","cardBg":"#FFFFFF","border":"#000000","error":"#B91C1C","success":"#15803D","warning":"#B45309"}', 1, 1);
