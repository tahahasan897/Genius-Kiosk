import { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pipette, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  onEyedropperRequest?: () => void; // Callback when eyedropper is clicked
}

// Professional color palette - organized by hue
const colorPresets = [
  // Grays
  ['#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#0f172a', '#000000'],
  // Reds
  ['#fef2f2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
  // Oranges
  ['#fff7ed', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
  // Yellows
  ['#fefce8', '#fef08a', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12'],
  // Greens
  ['#f0fdf4', '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
  // Teals
  ['#f0fdfa', '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'],
  // Blues
  ['#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
  // Purples
  ['#faf5ff', '#e9d5ff', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#5b21b6'],
  // Pinks
  ['#fdf2f8', '#fbcfe8', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'],
];

// Flatten presets for quick lookup
const allPresetColors = new Set(colorPresets.flat().map(c => c.toLowerCase()));

const STORAGE_KEY = 'map-editor-custom-colors';
const MAX_CUSTOM_COLORS = 16;

// Load custom colors from localStorage
const loadCustomColors = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((c): c is string => typeof c === 'string');
      }
    }
  } catch {
    // Ignore errors
  }
  return [];
};

// Save custom colors to localStorage
const saveCustomColors = (colors: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignore errors
  }
};

const ColorPicker = ({
  color,
  onChange,
  label,
  showOpacity = false,
  opacity = 1,
  onOpacityChange,
  onEyedropperRequest,
}: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(color);
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const [pickerColor, setPickerColor] = useState(color); // Track color during picker drag
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync input value with prop
  useEffect(() => {
    setInputValue(color);
    setPickerColor(color);
  }, [color]);

  // Check if a color is custom (not in presets)
  const isCustomColor = useCallback((c: string): boolean => {
    return !allPresetColors.has(c.toLowerCase());
  }, []);

  // Add a color to custom colors if it's not a preset
  const addToCustomColors = useCallback((newColor: string) => {
    const normalizedColor = newColor.toLowerCase();

    // Don't add if it's a preset color
    if (!isCustomColor(newColor)) return;

    setCustomColors(prev => {
      // Check if already exists
      if (prev.some(c => c.toLowerCase() === normalizedColor)) {
        // Move to front if it exists
        const filtered = prev.filter(c => c.toLowerCase() !== normalizedColor);
        const updated = [newColor, ...filtered];
        saveCustomColors(updated);
        return updated;
      }

      // Add to front, limit to max
      const updated = [newColor, ...prev].slice(0, MAX_CUSTOM_COLORS);
      saveCustomColors(updated);
      return updated;
    });
  }, [isCustomColor]);

  // Remove a color from custom colors
  const removeFromCustomColors = (colorToRemove: string) => {
    setCustomColors(prev => {
      const updated = prev.filter(c => c.toLowerCase() !== colorToRemove.toLowerCase());
      saveCustomColors(updated);
      return updated;
    });
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Only update if it's a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value) || /^#[0-9A-Fa-f]{3}$/.test(value)) {
      onChange(value);
      addToCustomColors(value);
    }
  };

  const handleInputBlur = () => {
    // Reset to current color if invalid
    if (!/^#[0-9A-Fa-f]{6}$/.test(inputValue) && !/^#[0-9A-Fa-f]{3}$/.test(inputValue)) {
      setInputValue(color);
    }
  };

  // Handle live preview while dragging in native picker (only update local state for speed)
  const handleNativeColorChange = (newColor: string) => {
    // Only update local state for fast preview - don't call parent onChange yet
    setInputValue(newColor);
    setPickerColor(newColor);
  };

  // Handle when native picker closes (user confirmed the color)
  const handleNativePickerClose = () => {
    // Now propagate to parent and save to custom colors
    onChange(pickerColor);
    addToCustomColors(pickerColor);
  };

  const handlePresetClick = (presetColor: string) => {
    onChange(presetColor);
    setInputValue(presetColor);
  };

  const handleCustomColorClick = (customColor: string) => {
    onChange(customColor);
    setInputValue(customColor);
    // Move to front of list
    addToCustomColors(customColor);
  };

  // Save current color as custom
  const saveCurrentAsCustom = () => {
    if (isCustomColor(pickerColor)) {
      addToCustomColors(pickerColor);
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium">{label}</Label>}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'w-full h-10 rounded-lg border border-input flex items-center gap-3 px-3',
              'hover:border-primary/50 transition-colors cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          >
            {/* Color swatch */}
            <div
              className="w-6 h-6 rounded-md border border-border shadow-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Hex value */}
            <span className="flex-1 text-left text-sm font-mono text-foreground">
              {color.toUpperCase()}
            </span>

            {/* Pipette icon */}
            <Pipette className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            {/* Native color picker + hex input */}
            <div className="flex gap-2">
              <div className="relative">
                <div
                  className="w-12 h-10 rounded-lg border border-input cursor-pointer overflow-hidden"
                  style={{ backgroundColor: pickerColor }}
                  onClick={() => colorInputRef.current?.click()}
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={pickerColor}
                  onChange={(e) => handleNativeColorChange(e.target.value)}
                  onBlur={handleNativePickerClose}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleInputBlur}
                className="flex-1 h-10 text-sm font-mono uppercase"
                placeholder="#000000"
              />
              {/* Eyedropper button */}
              {onEyedropperRequest && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={() => {
                    setIsOpen(false); // Close the popover
                    onEyedropperRequest();
                  }}
                  title="Pick color from canvas"
                >
                  <Pipette className="h-4 w-4" />
                </Button>
              )}
              {/* Save button - only show if current color is custom and not already saved */}
              {isCustomColor(pickerColor) && !customColors.some(c => c.toLowerCase() === pickerColor.toLowerCase()) && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={saveCurrentAsCustom}
                  title="Save to custom colors"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Custom/Recent Colors */}
            {customColors.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Custom Colors
                  </Label>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setCustomColors([]);
                      saveCustomColors([]);
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {customColors.map((customColor) => (
                    <div key={customColor} className="relative group">
                      <button
                        className={cn(
                          'w-6 h-6 rounded-md border transition-all',
                          'hover:scale-110 hover:z-10 hover:shadow-md',
                          'focus:outline-none focus:ring-2 focus:ring-ring',
                          pickerColor.toLowerCase() === customColor.toLowerCase()
                            ? 'ring-2 ring-primary ring-offset-1'
                            : 'border-border/50'
                        )}
                        style={{ backgroundColor: customColor }}
                        onClick={() => handleCustomColorClick(customColor)}
                        title={customColor}
                      />
                      {/* Remove button on hover */}
                      <button
                        className={cn(
                          'absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full',
                          'bg-destructive text-destructive-foreground',
                          'flex items-center justify-center',
                          'opacity-0 group-hover:opacity-100 transition-opacity',
                          'hover:bg-destructive/80'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCustomColors(customColor);
                        }}
                        title="Remove color"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Color presets */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Presets
              </Label>
              <div className="grid gap-1">
                {colorPresets.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1">
                    {row.map((presetColor) => (
                      <button
                        key={presetColor}
                        className={cn(
                          'w-6 h-6 rounded-md border transition-all',
                          'hover:scale-110 hover:z-10 hover:shadow-md',
                          'focus:outline-none focus:ring-2 focus:ring-ring',
                          pickerColor.toLowerCase() === presetColor.toLowerCase()
                            ? 'ring-2 ring-primary ring-offset-1'
                            : 'border-border/50'
                        )}
                        style={{ backgroundColor: presetColor }}
                        onClick={() => handlePresetClick(presetColor)}
                        title={presetColor}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Opacity slider (optional) */}
            {showOpacity && onOpacityChange && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Opacity</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <div className="relative h-6 rounded-md overflow-hidden border border-input">
                  {/* Checkerboard background for transparency preview */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%),
                                        linear-gradient(-45deg, #ccc 25%, transparent 25%),
                                        linear-gradient(45deg, transparent 75%, #ccc 75%),
                                        linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                    }}
                  />
                  {/* Color overlay with gradient */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to right, transparent, ${pickerColor})`,
                    }}
                  />
                  {/* Range input */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacity * 100}
                    onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {/* Slider thumb indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white border border-gray-400 rounded-full shadow-sm pointer-events-none"
                    style={{ left: `calc(${opacity * 100}% - 2px)` }}
                  />
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => handlePresetClick('#000000')}
              >
                Black
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => handlePresetClick('#ffffff')}
              >
                White
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => handlePresetClick('#3b82f6')}
              >
                Blue
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ColorPicker;
