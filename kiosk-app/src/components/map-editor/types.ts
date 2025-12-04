export type ElementType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram' | 'smart-pin' | 'static-pin';

export type Tool = 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram' | 'smart-pin' | 'static-pin';

export type NameVisibility = 'layers' | 'canvas' | 'both' | 'none';

// Animation styles for pins: 1=Pulse, 2=Bounce, 3=Ripple, 4=Flash, 5=Glow
export type AnimationStyle = 1 | 2 | 3 | 4 | 5;

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
  // Pin-specific properties
  animationStyle?: AnimationStyle;
  pinLabel?: string; // Label for static pins (e.g., "Restroom", "Cashier")
  metadata?: any;
  // Persistence flag to help with linking UX
  persisted?: boolean;
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
  labelOffsetY: -25,
  animationStyle: 1, // Default to Pulse
};

// Default pin element properties
export const defaultSmartPin: Partial<MapElement> = {
  ...defaultElement,
  fillColor: '#ef4444', // Red for smart pins
  fillOpacity: 1,
  strokeColor: '#b91c1c',
  strokeWidth: 2,
  animationStyle: 1,
  showNameOn: 'layers',
};

export const defaultStaticPin: Partial<MapElement> = {
  ...defaultElement,
  fillColor: '#22c55e', // Green for static pins
  fillOpacity: 1,
  strokeColor: '#15803d',
  strokeWidth: 2,
  animationStyle: 5, // Glow for static
  showNameOn: 'canvas',
  pinLabel: 'Label',
};

// Default sizes for click-to-place elements
export const defaultSizes: Record<ElementType, { width: number; height: number }> = {
  rectangle: { width: 120, height: 80 },
  circle: { width: 80, height: 80 },
  line: { width: 100, height: 0 },
  arrow: { width: 100, height: 0 },
  polygon: { width: 80, height: 80 },
  text: { width: 200, height: 40 },
  freehand: { width: 0, height: 0 },
  triangle: { width: 80, height: 80 },
  trapezoid: { width: 120, height: 80 },
  parallelogram: { width: 120, height: 80 },
  'smart-pin': { width: 40, height: 50 },
  'static-pin': { width: 40, height: 50 },
};

// Animation style labels for UI
export const animationStyleLabels: Record<AnimationStyle, string> = {
  1: 'Pulse',
  2: 'Bounce',
  3: 'Ripple',
  4: 'Flash',
  5: 'Glow',
};

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

