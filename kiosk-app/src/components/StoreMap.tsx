import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, RegularPolygon, Group, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Product } from '@/data/products';

interface StoreMapProps {
  selectedProduct: Product | null;
  storeId?: number;
}

interface MapElement {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  rotation: number;
  visible: boolean;
  zIndex: number;
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  points?: number[];
  freehandPoints?: number[];
  sides?: number;
  animationStyle?: number;
  pinLabel?: string;
  showNameOn?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

// Animation CSS keyframes
const animationStyles = `
@keyframes pulse-pin {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
}
@keyframes bounce-pin {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes ripple-pin {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  100% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
}
@keyframes flash-pin {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0.3; }
}
@keyframes glow-pin {
  0%, 100% { filter: drop-shadow(0 0 5px currentColor); }
  50% { filter: drop-shadow(0 0 15px currentColor); }
}
`;

const StoreMap = ({ selectedProduct, storeId = 1 }: StoreMapProps) => {
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [elements, setElements] = useState<MapElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSmartPins, setActiveSmartPins] = useState<string[]>([]);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load map image
  const [loadedImage] = useImage(mapImageUrl ? `${API_URL}${mapImageUrl}` : '');

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map`);
        if (!response.ok) {
          throw new Error('Failed to load map');
        }
        
        const data = await response.json();
        
        if (data.store?.map_image_url) {
          setMapImageUrl(data.store.map_image_url);
        }
        
        if (data.elements && data.elements.length > 0) {
          setElements(data.elements.map((el: any) => {
            const metadata = typeof el.metadata === 'string' 
              ? JSON.parse(el.metadata) 
              : (el.metadata || {});
            
            return {
              id: el.id.toString(),
              type: metadata.type || el.element_type || 'rectangle',
              name: metadata.name ?? el.name ?? '',
              x: (el.x / 100) * CANVAS_WIDTH,
              y: (el.y / 100) * CANVAS_HEIGHT,
              width: (el.width / 100) * CANVAS_WIDTH,
              height: (el.height / 100) * CANVAS_HEIGHT,
              rotation: metadata.rotation ?? 0,
              fillColor: metadata.fillColor ?? el.color ?? '#3b82f6',
              fillOpacity: metadata.fillOpacity ?? 0.5,
              strokeColor: metadata.strokeColor ?? el.color ?? '#1d4ed8',
              strokeWidth: metadata.strokeWidth ?? 2,
              strokeOpacity: metadata.strokeOpacity ?? 1,
              visible: metadata.visible ?? true,
              zIndex: metadata.zIndex ?? el.z_index ?? 0,
              cornerRadius: metadata.cornerRadius ?? 0,
              text: metadata.text,
              fontSize: metadata.fontSize ?? 24,
              fontFamily: metadata.fontFamily ?? 'Arial',
              fontWeight: metadata.fontWeight ?? 'normal',
              textAlign: metadata.textAlign ?? 'center',
              points: metadata.points,
              freehandPoints: metadata.freehandPoints,
              sides: metadata.sides ?? 6,
              animationStyle: metadata.animationStyle ?? 1,
              pinLabel: metadata.pinLabel ?? '',
              showNameOn: metadata.showNameOn ?? 'layers',
            };
          }));
        }
      } catch (err) {
        console.error('Error loading map:', err);
        setError('Unable to load store map');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMapData();
  }, [storeId]);

  // Update active smart pins when selected product changes
  useEffect(() => {
    if (selectedProduct?.mapElementId) {
      setActiveSmartPins([selectedProduct.mapElementId.toString()]);
    } else {
      setActiveSmartPins([]);
    }
  }, [selectedProduct]);

  // Calculate scale to fit container
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const scaleX = containerWidth / CANVAS_WIDTH;
        const scaleY = containerHeight / CANVAS_HEIGHT;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Get trapezoid points
  const getTrapezoidPoints = (width: number, height: number): number[] => {
    const topOffset = width * 0.2;
    return [topOffset, 0, width - topOffset, 0, width, height, 0, height];
  };

  // Get parallelogram points
  const getParallelogramPoints = (width: number, height: number): number[] => {
    const offset = width * 0.2;
    return [offset, 0, width, 0, width - offset, height, 0, height];
  };

  // Get animation class based on style
  const getAnimationClass = (animationStyle: number) => {
    switch (animationStyle) {
      case 1: return 'animate-pulse-pin';
      case 2: return 'animate-bounce-pin';
      case 3: return 'animate-ripple-pin';
      case 4: return 'animate-flash-pin';
      case 5: return 'animate-glow-pin';
      default: return 'animate-pulse-pin';
    }
  };

  // Render element
  const renderElement = (element: MapElement) => {
    if (!element.visible) return null;

    const commonProps = {
      x: element.x,
      y: element.y,
      rotation: element.rotation,
    };

    switch (element.type) {
      case 'rectangle':
        return (
          <Rect
            key={element.id}
            {...commonProps}
            width={element.width}
            height={element.height}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            cornerRadius={element.cornerRadius}
          />
        );
      case 'circle':
        return (
          <Circle
            key={element.id}
            {...commonProps}
            radius={element.width / 2}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'triangle':
        return (
          <RegularPolygon
            key={element.id}
            {...commonProps}
            sides={3}
            radius={element.width / 2}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'trapezoid':
        return (
          <Line
            key={element.id}
            {...commonProps}
            points={getTrapezoidPoints(element.width, element.height)}
            closed={true}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'parallelogram':
        return (
          <Line
            key={element.id}
            {...commonProps}
            points={getParallelogramPoints(element.width, element.height)}
            closed={true}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'polygon':
        return (
          <RegularPolygon
            key={element.id}
            {...commonProps}
            sides={element.sides || 6}
            radius={element.width / 2}
            fill={element.fillColor}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'line':
        return (
          <Line
            key={element.id}
            points={element.points || [0, 0, 100, 0]}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'arrow':
        return (
          <Line
            key={element.id}
            points={element.points || [0, 0, 100, 0]}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
          />
        );
      case 'text':
        return (
          <KonvaText
            key={element.id}
            {...commonProps}
            text={element.text || 'Text'}
            fontSize={element.fontSize}
            fontFamily={element.fontFamily}
            fill={element.fillColor}
            align={element.textAlign}
            width={element.width}
          />
        );
      case 'freehand':
        return (
          <Line
            key={element.id}
            points={element.freehandPoints || []}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        );
      // Static pins are always visible
      case 'static-pin':
        return (
          <Group key={element.id} x={element.x} y={element.y}>
            <Line
              points={[
                -element.width / 2 + 5, -element.height + 10,
                element.width / 2 - 5, -element.height + 10,
                element.width / 2, -element.height + 15,
                element.width / 2, -15,
                element.width / 2 - 5, -10,
                5, -10,
                0, 0,
                -5, -10,
                -element.width / 2 + 5, -10,
                -element.width / 2, -15,
                -element.width / 2, -element.height + 15,
                -element.width / 2 + 5, -element.height + 10,
              ]}
              closed={true}
              fill={element.fillColor}
              opacity={element.fillOpacity}
              stroke={element.strokeColor}
              strokeWidth={element.strokeWidth}
              lineJoin="round"
            />
            {element.pinLabel && (
              <KonvaText
                text={element.pinLabel}
                x={-element.width / 2}
                y={-element.height + 25}
                width={element.width}
                fontSize={10}
                fontFamily="Arial"
                fontStyle="bold"
                fill="#ffffff"
                align="center"
              />
            )}
          </Group>
        );
      default:
        return null;
    }
  };

  // Render active smart pin (when product is selected)
  const renderActiveSmartPin = (element: MapElement) => {
    if (element.type !== 'smart-pin' || !activeSmartPins.includes(element.id)) {
      return null;
    }

    return (
      <Group key={`active-${element.id}`} x={element.x} y={element.y}>
        {/* Animated pin body */}
        <Line
          points={[
            -element.width / 2 + 5, -element.height + 10,
            element.width / 2 - 5, -element.height + 10,
            element.width / 2, -element.height + 15,
            element.width / 2, -15,
            element.width / 2 - 5, -10,
            5, -10,
            0, 0,
            -5, -10,
            -element.width / 2 + 5, -10,
            -element.width / 2, -15,
            -element.width / 2, -element.height + 15,
            -element.width / 2 + 5, -element.height + 10,
          ]}
          closed={true}
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth={2}
          lineJoin="round"
        />
        {/* Location info bubble */}
        {selectedProduct && (
          <>
            <Rect
              x={-60}
              y={-element.height - 35}
              width={120}
              height={30}
              fill="#1f2937"
              cornerRadius={6}
            />
            <KonvaText
              text={`Aisle ${selectedProduct.aisle}${selectedProduct.shelf ? `, Shelf ${selectedProduct.shelf}` : ''}`}
              x={-60}
              y={-element.height - 30}
              width={120}
              fontSize={12}
              fontFamily="Arial"
              fontStyle="bold"
              fill="#ffffff"
              align="center"
            />
          </>
        )}
      </Group>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading store map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // No map data - fall back to simple view
  if (!mapImageUrl && elements.length === 0) {
    return (
      <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden">
        <div className="h-full relative bg-secondary/30">
          <div className="absolute inset-0 p-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-foreground">Store Map</h2>
              <p className="text-lg text-muted-foreground mt-1">Find your product location</p>
            </div>

            <div className="relative w-full h-[calc(100%-5rem)] border-4 border-primary/20 rounded-xl bg-white overflow-hidden flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Map not configured</p>
                <p className="text-sm">Contact store manager to set up the map</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden">
      <style>{animationStyles}</style>
      
      <div className="h-full relative bg-secondary/30">
        <div className="absolute inset-0 p-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Store Map</h2>
              <p className="text-sm text-muted-foreground">
                {selectedProduct 
                  ? `Showing location for: ${selectedProduct.name}`
                  : 'Select a product to see its location'
                }
              </p>
            </div>
            
            {/* Legend */}
            <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow border border-border">
              <div className="flex items-center gap-4 text-sm">
                {selectedProduct && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500" />
                    <span>Your Product</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>Facility</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Canvas */}
          <div 
            ref={containerRef}
            className="relative w-full h-[calc(100%-4rem)] border-2 border-border rounded-xl bg-white overflow-hidden flex items-center justify-center"
          >
            <Stage
              width={CANVAS_WIDTH * scale}
              height={CANVAS_HEIGHT * scale}
              scaleX={scale}
              scaleY={scale}
              style={{ background: '#ffffff' }}
            >
              <Layer>
                {/* Background image */}
                {loadedImage && (
                  <KonvaImage
                    image={loadedImage}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    opacity={0.9}
                  />
                )}

                {/* Map elements (shapes, text, etc.) */}
                {elements
                  .filter(el => el.type !== 'smart-pin')
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map(renderElement)}

                {/* Active smart pins with product info */}
                {elements
                  .filter(el => el.type === 'smart-pin')
                  .map(renderActiveSmartPin)}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreMap;
