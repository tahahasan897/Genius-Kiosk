export type ElementType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram' | 'smart-pin' | 'static-pin' | 'device-pin' | 'group';

export type Tool = 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram' | 'smart-pin' | 'static-pin' | 'device-pin' | 'eraser';

export type NameVisibility = 'layers' | 'canvas' | 'both' | 'none';

// Animation styles for pins: 0=Set animation (none), 1=Pulse, 2=Bounce, 3=Ripple, 4=Flash, 5=Glow
export type AnimationStyle = 0 | 1 | 2 | 3 | 4 | 5;

// Stroke style types
export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

// Gradient types
export interface GradientStop {
  position: number;  // 0-100 percentage
  color: string;
  opacity?: number;
}

export interface Gradient {
  type: 'solid' | 'linear' | 'radial';
  angle?: number;  // For linear gradients (0-360 degrees)
  stops?: GradientStop[];
}

// Text effect types
export interface TextShadow {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface TextOutline {
  enabled: boolean;
  width: number;
  color: string;
}

export interface TextGlow {
  enabled: boolean;
  blur: number;
  color: string;
}

// Text decoration type
export type TextDecoration = 'none' | 'underline' | 'line-through' | 'underline line-through';

export interface MapElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  // Colors
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  // Line/Arrow specific
  points?: number[];
  // Freehand specific
  freehandPoints?: number[];
  // Polygon specific
  sides?: number;
  // Layer properties
  visible: boolean;
  locked: boolean;
  zIndex: number;
  // Border radius for shapes that support it
  cornerRadius?: number;
  // Name visibility
  showNameOn?: NameVisibility;
  // Name label position offset (relative to element)
  labelOffsetX?: number;
  labelOffsetY?: number;
  // Label styling (for element names on shapes)
  labelFontSize?: number;
  labelFontFamily?: string;
  labelFontWeight?: 'normal' | 'bold';
  labelColor?: string;
  // Pin-specific properties
  animationStyle?: AnimationStyle;
  motionScale?: number; // Animation speed multiplier (0.25 = slow, 1 = normal, 3 = fast)
  pinLabel?: string; // Label for static pins (e.g., "Restroom", "Cashier")
  pinLabelFontSize?: number; // Font size for pin label
  pinLabelColor?: string; // Color for pin label text
  pinLabelFontWeight?: 'normal' | 'bold'; // Font weight for pin label
  pinLabelFontFamily?: string; // Font family for pin label
  metadata?: any;
  // Persistence flag to help with linking UX
  persisted?: boolean;

  // Flip/Transform properties
  scaleX?: number;  // 1 or -1 for horizontal flip
  scaleY?: number;  // 1 or -1 for vertical flip

  // Grouping properties
  groupId?: string;           // Parent group ID (if this element is in a group)
  isGroup?: boolean;          // True if this element is a group container
  childIds?: string[];        // For groups: list of child element IDs

  // Stroke style
  strokeStyle?: StrokeStyle;

  // Gradient fill
  gradient?: Gradient;

  // Text effects
  textShadow?: TextShadow;
  textOutline?: TextOutline;
  textGlow?: TextGlow;

  // Additional text properties
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: TextDecoration;
}

export interface EditorState {
  tool: Tool;
  elements: MapElement[];
  selectedElementId: string | null;
  isDrawing: boolean;
  drawStart: { x: number; y: number } | null;
}

export const defaultElement: Partial<MapElement> = {
  fillColor: '#3b82f6',
  fillOpacity: 0.5,
  strokeColor: '#1d4ed8',
  strokeWidth: 2,
  strokeOpacity: 1,
  rotation: 0,
  visible: true,
  locked: false,
  cornerRadius: 0,
  fontSize: 24,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  textAlign: 'center',
  sides: 6,
  showNameOn: 'both',
  labelOffsetX: 0,
  labelOffsetY: 0,
  labelFontSize: 28,
  labelFontFamily: 'Arial',
  labelFontWeight: 'normal',
  labelColor: '#000000',
  animationStyle: 0, // Default to "Set animation" (no animation until user selects one)
  // New defaults
  scaleX: 1,
  scaleY: 1,
  strokeStyle: 'solid',
  letterSpacing: 0,
  lineHeight: 1,
  textDecoration: 'none',
};

// Default pin element properties
export const defaultSmartPin: Partial<MapElement> = {
  ...defaultElement,
  fillColor: '#ef4444', // Red for smart pins
  fillOpacity: 1,
  strokeColor: '#b91c1c',
  strokeWidth: 2,
  animationStyle: 0, // Default to "Set animation" (no animation until user selects one)
  motionScale: 1, // Default animation speed
  showNameOn: 'layers',
};

export const defaultStaticPin: Partial<MapElement> = {
  ...defaultElement,
  fillColor: '#22c55e', // Green for static pins
  fillOpacity: 1,
  strokeColor: '#15803d',
  strokeWidth: 2,
  animationStyle: 0, // Default to "Set animation" (no animation until user selects one)
  motionScale: 1, // Default animation speed
  showNameOn: 'canvas',
  pinLabel: '', // No placeholder text - user will add label with cursor
  pinLabelFontSize: 16, // Increased from 14 for better visibility
  pinLabelColor: '#ffffff',
  pinLabelFontWeight: 'normal', // Normal weight for cleaner look
  pinLabelFontFamily: 'Inter, system-ui, -apple-system, sans-serif', // Modern readable font
};

export const defaultDevicePin: Partial<MapElement> = {
  ...defaultElement,
  fillColor: '#6366f1', // Indigo/purple for device pins
  fillOpacity: 1,
  strokeColor: '#4338ca',
  strokeWidth: 2,
  animationStyle: 0, // Default to "Set animation" (no animation until user selects one)
  motionScale: 1, // Default animation speed
  showNameOn: 'canvas',
  pinLabel: '', // No placeholder text - user will add label with cursor
  pinLabelFontSize: 14,
  pinLabelColor: '#ffffff',
  pinLabelFontWeight: 'normal',
  pinLabelFontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

// Default sizes for click-to-place elements
export const defaultSizes: Record<ElementType, { width: number; height: number }> = {
  rectangle: { width: 120, height: 80 },
  circle: { width: 110, height: 110 },
  line: { width: 100, height: 0 },
  arrow: { width: 100, height: 0 },
  polygon: { width: 120, height: 120 },
  text: { width: 200, height: 40 },
  freehand: { width: 0, height: 0 },
  triangle: { width: 120, height: 120 },
  trapezoid: { width: 120, height: 80 },
  parallelogram: { width: 120, height: 120 },
  'smart-pin': { width: 30, height: 40 },
  'static-pin': { width: 55, height: 55 },
  'device-pin': { width: 50, height: 60 },
  'group': { width: 100, height: 100 },
};

// Animation style labels for UI
export const animationStyleLabels: Record<AnimationStyle, string> = {
  0: 'Set animation',
  1: 'Pulse',
  2: 'Bounce',
  3: 'Ripple',
  4: 'Flash',
  5: 'Glow',
};

// Stroke dash patterns for different line styles
export const STROKE_DASH_PATTERNS: Record<StrokeStyle, number[]> = {
  'solid': [],
  'dashed': [10, 5],
  'dotted': [2, 4],
  'dash-dot': [10, 5, 2, 5],
};

// Safe getter for stroke dash pattern
export const getStrokeDash = (strokeStyle?: string): number[] => {
  if (!strokeStyle || !(strokeStyle in STROKE_DASH_PATTERNS)) {
    return [];
  }
  return STROKE_DASH_PATTERNS[strokeStyle as StrokeStyle];
};

// Default group element properties
export const defaultGroup: Partial<MapElement> = {
  ...defaultElement,
  isGroup: true,
  childIds: [],
  fillColor: 'transparent',
  fillOpacity: 0,
  strokeColor: '#6366f1',
  strokeWidth: 1,
  strokeOpacity: 0.5,
  strokeStyle: 'dashed',
};

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

/**
 * Calculate the scale factor to fit the canvas into a container while maintaining aspect ratio.
 * Used consistently across editor, preview, and live map for zoom consistency.
 * @param containerWidth - Width of the container
 * @param containerHeight - Height of the container
 * @param padding - Optional padding to subtract from container dimensions (default 0)
 * @returns Scale factor (capped at 1 to prevent upscaling)
 */
export const calculateFitToViewScale = (
  containerWidth: number,
  containerHeight: number,
  padding: number = 0
): number => {
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  const scaleX = availableWidth / CANVAS_WIDTH;
  const scaleY = availableHeight / CANVAS_HEIGHT;
  return Math.min(scaleX, scaleY, 1);
};
