import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeColors {
  primary: string; // HSL format: "217 91% 60%"
  primaryForeground: string;
  accent: string;
  accentForeground: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  updateTheme: (colors: Partial<ThemeColors>) => void;
  resetTheme: () => void;
}

const defaultTheme: ThemeColors = {
  primary: '217 91% 60%', // Blue
  primaryForeground: '0 0% 100%',
  accent: '142 76% 36%', // Green
  accentForeground: '0 0% 100%',
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      colors: defaultTheme,
      updateTheme: () => {},
      resetTheme: () => {},
    };
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialColors?: Partial<ThemeColors>;
}

export const ThemeProvider = ({ children, initialColors }: ThemeProviderProps) => {
  const [colors, setColors] = useState<ThemeColors>({
    ...defaultTheme,
    ...initialColors,
  });

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-foreground', colors.primaryForeground);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-foreground', colors.accentForeground);
  }, [colors]);

  const updateTheme = (newColors: Partial<ThemeColors>) => {
    setColors((prev) => ({ ...prev, ...newColors }));
    // Optionally save to localStorage for persistence
    localStorage.setItem('store-theme', JSON.stringify({ ...colors, ...newColors }));
  };

  const resetTheme = () => {
    setColors(defaultTheme);
    localStorage.removeItem('store-theme');
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('store-theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setColors((prev) => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading saved theme:', error);
      }
    }
  }, []);

  const value: ThemeContextType = {
    colors,
    updateTheme,
    resetTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

