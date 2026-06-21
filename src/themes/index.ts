export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textHeading: string;
  accent: string;
  buttonPrimary: string;
  cardBg: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

export interface Theme {
  id: string;
  name: string;
  isPreset: boolean;
  tenantId: number | null;
  colors: ThemeColors;
}

export const PRESET_THEMES: Theme[] = [
  {
    id: 'light',
    name: 'Светлая (классическая)',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F1F5F9',
      textPrimary: '#1A1A1A',
      textSecondary: '#64748B',
      textHeading: '#0F172A',
      accent: '#2563EB',
      buttonPrimary: '#2563EB',
      cardBg: '#FFFFFF',
      border: '#E2E8F0',
      error: '#DC2626',
      success: '#16A34A',
      warning: '#D97706',
    },
  },
  {
    id: 'dark',
    name: 'Тёмная (ночная)',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#121212',
      bgSecondary: '#1E1E1E',
      textPrimary: '#FFFFFF',
      textSecondary: '#A1A1AA',
      textHeading: '#FAFAFA',
      accent: '#7C3AED',
      buttonPrimary: '#7C3AED',
      cardBg: '#1E1E1E',
      border: '#2D2D2D',
      error: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
    },
  },
  {
    id: 'sunny',
    name: 'Солнечная',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#FFF8E7',
      bgSecondary: '#FFFAF0',
      textPrimary: '#4A3000',
      textSecondary: '#8B7355',
      textHeading: '#3B2200',
      accent: '#F59E0B',
      buttonPrimary: '#F59E0B',
      cardBg: '#FFFFFF',
      border: '#FDE68A',
      error: '#DC2626',
      success: '#16A34A',
      warning: '#D97706',
    },
  },
  {
    id: 'ocean',
    name: 'Морская',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#F0F9FF',
      bgSecondary: '#E0F2FE',
      textPrimary: '#0C4A6E',
      textSecondary: '#0284C7',
      textHeading: '#082F49',
      accent: '#0EA5E9',
      buttonPrimary: '#0EA5E9',
      cardBg: '#FFFFFF',
      border: '#BAE6FD',
      error: '#E11D48',
      success: '#059669',
      warning: '#D97706',
    },
  },
  {
    id: 'forest',
    name: 'Лесная',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#F2F9F2',
      bgSecondary: '#E6F5E6',
      textPrimary: '#14532D',
      textSecondary: '#4A7C59',
      textHeading: '#0A3D1E',
      accent: '#22C55E',
      buttonPrimary: '#22C55E',
      cardBg: '#FFFFFF',
      border: '#BBF7D0',
      error: '#DC2626',
      success: '#16A34A',
      warning: '#CA8A04',
    },
  },
  {
    id: 'rose',
    name: 'Розовая',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#FFF1F2',
      bgSecondary: '#FFE4E6',
      textPrimary: '#831843',
      textSecondary: '#BE185D',
      textHeading: '#4C0519',
      accent: '#EC4899',
      buttonPrimary: '#EC4899',
      cardBg: '#FFFFFF',
      border: '#FBCFE8',
      error: '#E11D48',
      success: '#16A34A',
      warning: '#D97706',
    },
  },
  {
    id: 'cosmic',
    name: 'Космическая',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#0F172A',
      bgSecondary: '#1E293B',
      textPrimary: '#E2E8F0',
      textSecondary: '#94A3B8',
      textHeading: '#F8FAFC',
      accent: '#8B5CF6',
      buttonPrimary: '#8B5CF6',
      cardBg: '#1E293B',
      border: '#334155',
      error: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
    },
  },
  {
    id: 'minimal',
    name: 'Минималистичная',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#F8FAFC',
      bgSecondary: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textHeading: '#020617',
      accent: '#475569',
      buttonPrimary: '#475569',
      cardBg: '#FFFFFF',
      border: '#CBD5E1',
      error: '#DC2626',
      success: '#16A34A',
      warning: '#D97706',
    },
  },
  {
    id: 'contrast',
    name: 'Контрастная',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F5F5F5',
      textPrimary: '#000000',
      textSecondary: '#1A1A1A',
      textHeading: '#000000',
      accent: '#DC2626',
      buttonPrimary: '#DC2626',
      cardBg: '#FFFFFF',
      border: '#000000',
      error: '#B91C1C',
      success: '#15803D',
      warning: '#B45309',
    },
  },
  {
    id: 'vintage',
    name: 'Винтажная',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#FEF3C7',
      bgSecondary: '#FDE68A',
      textPrimary: '#78350F',
      textSecondary: '#92400E',
      textHeading: '#451A03',
      accent: '#B45309',
      buttonPrimary: '#B45309',
      cardBg: '#FFFBEB',
      border: '#D97706',
      error: '#B91C1C',
      success: '#15803D',
      warning: '#A16207',
    },
  },
  {
    id: 'brutal',
    name: 'Светлый брутальный',
    isPreset: true,
    tenantId: null,
    colors: {
      bgPrimary: '#F5F5F5',
      bgSecondary: '#E5E5E5',
      textPrimary: '#1A1A1A',
      textSecondary: '#404040',
      textHeading: '#000000',
      accent: '#D32F2F',
      buttonPrimary: '#D32F2F',
      cardBg: '#FFFFFF',
      border: '#000000',
      error: '#B91C1C',
      success: '#15803D',
      warning: '#B45309',
    },
  },
];

export function getThemeById(id: string): Theme | undefined {
  return PRESET_THEMES.find(t => t.id === id);
}

export function themeToCssVars(colors: ThemeColors): Record<string, string> {
  return {
    '--bg-primary': colors.bgPrimary,
    '--bg-secondary': colors.bgSecondary,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-heading': colors.textHeading,
    '--accent': colors.accent,
    '--button-primary': colors.buttonPrimary,
    '--card-bg': colors.cardBg,
    '--border': colors.border,
    '--error': colors.error,
    '--success': colors.success,
    '--warning': colors.warning,
  };
}

export function applyThemeToDocument(colors: ThemeColors): void {
  const vars = themeToCssVars(colors);
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}
