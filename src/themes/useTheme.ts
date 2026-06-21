import { useEffect, useCallback } from 'react';
import { useApp } from '../context';
import { getThemeById, applyThemeToDocument, PRESET_THEMES } from './index';

export function useTheme() {
  const { themeId, setThemeId } = useApp();

  const currentTheme = getThemeById(themeId || 'light') || PRESET_THEMES[0];

  const changeTheme = useCallback((id: string) => {
    setThemeId(id);
    const theme = getThemeById(id);
    if (theme) applyThemeToDocument(theme.colors);
  }, [setThemeId]);

  useEffect(() => {
    const theme = getThemeById(themeId || 'light');
    if (theme) applyThemeToDocument(theme.colors);
  }, [themeId]);

  return { currentTheme, changeTheme, themeId };
}
