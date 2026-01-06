'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Determine initial theme: use saved value if valid; otherwise detect system
    // Wrap in try/catch for Safari Private Mode
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('weatherflow-theme');
    } catch {
      // Safari Private Mode - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const detected: Theme = prefersDark ? 'dark' : 'light';
      setTheme(detected);
      setResolvedTheme(detected);
      return;
    }
    
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      setResolvedTheme(saved);
      return;
    }

    // Migrate legacy 'system' to detected default
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const detected: Theme = prefersDark ? 'dark' : 'light';
    setTheme(detected);
    setResolvedTheme(detected);
    try {
      localStorage.setItem('weatherflow-theme', detected);
    } catch {
      // Safari Private Mode - silently fail
    }
  }, []);

  useEffect(() => {
    setResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Save theme to localStorage - wrap in try/catch for Safari Private Mode
    try {
      localStorage.setItem('weatherflow-theme', theme);
    } catch {
      // Safari Private Mode - silently fail
    }
  }, [theme]);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
