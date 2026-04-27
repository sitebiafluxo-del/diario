import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_THEMES, applyTheme, getSavedTheme, saveTheme, generateThemeWithGemini } from '../lib/geminiThemes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme);
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const selectTheme = useCallback((themeKey) => {
    const theme = themes[themeKey] || themes.caderno;
    setCurrentTheme(theme);
    saveTheme(theme);
    applyTheme(theme);
  }, [themes]);

  const setCustomTheme = useCallback((theme) => {
    setCurrentTheme(theme);
    saveTheme(theme);
    applyTheme(theme);
  }, []);

  const generateAITheme = useCallback(async (prompt) => {
    setGenerating(true);
    try {
      const theme = await generateThemeWithGemini(prompt);
      if (theme) {
        const key = `ai_${Date.now()}`;
        setThemes((prev) => ({ ...prev, [key]: theme }));
        setCurrentTheme(theme);
        saveTheme(theme);
        applyTheme(theme);
        return theme;
      }
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themes,
        selectTheme,
        setCustomTheme,
        generateAITheme,
        generating,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
