import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

export type ColorPalette = 'pink' | 'purple' | 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'indigo';

interface ThemeContextType {
  mode: ThemeMode;
  palette: ColorPalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [palette, setPalette] = useState<ColorPalette>('pink');

  useEffect(() => {
    // Load from localStorage on mount
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    const savedPalette = localStorage.getItem('theme-palette') as ColorPalette | null;
    
    if (savedMode) setMode(savedMode);
    if (savedPalette) setPalette(savedPalette);
  }, []);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-palette', palette);
    
    // Also update class for compatibility
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    
    // Save to localStorage
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme-palette', palette);
  }, [mode, palette]);

  return (
    <ThemeContext.Provider value={{ mode, palette, setMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
