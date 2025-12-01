export type ElementType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram';

export type Tool = 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'triangle' | 'trapezoid' | 'parallelogram';

export type NameVisibility = 'layers' | 'canvas' | 'both' | 'none';

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
  metadata?: any;
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
};

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

