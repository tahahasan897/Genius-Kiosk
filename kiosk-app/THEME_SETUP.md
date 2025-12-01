# Theme Configuration Guide

The application uses a centralized theme system that allows stores to customize their brand colors. The theme is applied consistently across all pages, including the admin login page.

## Theme Structure

The theme system is defined in `src/contexts/ThemeContext.tsx` and uses CSS variables defined in `src/index.css`. All colors are stored in HSL format for better customization.

## Default Theme Colors

- **Primary**: Blue (`217 91% 60%`) - Used for buttons, links, and accents
- **Accent**: Green (`142 76% 36%`) - Used for success states and highlights

## Customizing Theme Colors

### Option 1: Programmatic Theme Update

You can update the theme programmatically using the `useTheme` hook:

```typescript
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { updateTheme } = useTheme();

  const changeToRed = () => {
    updateTheme({
      primary: '0 84% 60%', // Red
      primaryForeground: '0 0% 100%', // White text
    });
  };

  const changeToGreen = () => {
    updateTheme({
      primary: '142 76% 36%', // Green
      primaryForeground: '0 0% 100%', // White text
    });
  };

  return (
    <div>
      <button onClick={changeToRed}>Red Theme</button>
      <button onClick={changeToGreen}>Green Theme</button>
    </div>
  );
}
```

### Option 2: Store-Specific Theme

To load a theme based on store configuration, you can modify the `ThemeProvider` in `App.tsx`:

```typescript
// In App.tsx
import { ThemeProvider } from '@/contexts/ThemeContext';

// Get store theme from API or config
const storeTheme = {
  primary: '217 91% 60%', // Customize per store
  primaryForeground: '0 0% 100%',
};

<ThemeProvider initialColors={storeTheme}>
  {/* Your app */}
</ThemeProvider>
```

### Option 3: Environment Variables

You can also set default theme colors via environment variables and load them in the theme context.

## HSL Color Format

All colors use HSL format: `Hue Saturation% Lightness%`

Examples:
- Red: `0 84% 60%`
- Blue: `217 91% 60%`
- Green: `142 76% 36%`
- Purple: `271 81% 56%`
- Orange: `24 95% 53%`

You can use online tools like [HSL Color Picker](https://hslpicker.com/) to find your desired colors.

## Theme Persistence

The theme is automatically saved to localStorage when updated, so it persists across page reloads. To reset to defaults:

```typescript
const { resetTheme } = useTheme();
resetTheme();
```

## CSS Variables Used

The theme system uses these CSS variables (defined in `src/index.css`):

- `--primary`: Main brand color
- `--primary-foreground`: Text color on primary background
- `--accent`: Accent/secondary brand color
- `--accent-foreground`: Text color on accent background

These variables are automatically applied to all UI components that use the design system.

