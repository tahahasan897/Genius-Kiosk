import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, RegularPolygon, Group, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { MapPin, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  motionScale?: number;
  pinLabel?: string;
  pinLabelFontSize?: number;
  pinLabelColor?: string;
  pinLabelFontWeight?: string;
  showNameOn?: string;
}

import { calculateFitToViewScale } from './map-editor/types';

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

const BASE_SCALE = 0.58; // This represents "100%" zoom - fits the capture area perfectly

const StoreMap = ({ selectedProduct, storeId = 1 }: StoreMapProps) => {
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [elements, setElements] = useState<MapElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSmartPins, setActiveSmartPins] = useState<string[]>([]);
  const [scale, setScale] = useState(BASE_SCALE);
  const [manualZoom, setManualZoom] = useState<number | null>(BASE_SCALE); // Start at "100%" zoom
  const [fitScale, setFitScale] = useState(1); // The auto-fit scale for reference
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 }); // For panning/dragging
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Load map image
  const [loadedImage] = useImage(mapImageUrl ? `${API_URL}${mapImageUrl}` : '');

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map?published=true`);
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
              motionScale: metadata.motionScale ?? 1,
              pinLabel: metadata.pinLabel ?? '',
              pinLabelFontSize: metadata.pinLabelFontSize ?? 12,
              pinLabelColor: metadata.pinLabelColor ?? '#ffffff',
              pinLabelFontWeight: metadata.pinLabelFontWeight ?? 'normal',
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

  // Calculate scale to fit container using shared utility
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const newFitScale = calculateFitToViewScale(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        );
        setFitScale(newFitScale);
        // Use manual zoom if set, otherwise use auto-fit
        setScale(manualZoom !== null ? manualZoom : newFitScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [manualZoom]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setManualZoom(prev => {
      const currentScale = prev !== null ? prev : fitScale;
      return Math.min(currentScale * 1.25, 3);
    });
  }, [fitScale]);

  const handleZoomOut = useCallback(() => {
    setManualZoom(prev => {
      const currentScale = prev !== null ? prev : fitScale;
      return Math.max(currentScale / 1.25, 0.25);
    });
  }, [fitScale]);

  const handleResetZoom = useCallback(() => {
    setManualZoom(BASE_SCALE); // Reset to "100%" (0.58 scale)
    setStagePosition({ x: 0, y: 0 }); // Reset position too
  }, []);

  // Mouse wheel zoom handler
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = manualZoom !== null ? manualZoom : fitScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Zoom direction
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const zoomFactor = 1.1;

    let newScale = direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    newScale = Math.max(0.25, Math.min(3, newScale));

    setManualZoom(newScale);
  }, [fitScale, manualZoom]);

  // Touch pinch zoom state
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const lastSingleTouchPosition = useRef<{ x: number; y: number } | null>(null);

  // Touch handlers for pinch zoom and drag
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      // Pinch zoom start
      e.evt.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchCenter.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
      lastSingleTouchPosition.current = null;
    } else if (touches.length === 1) {
      // Single finger drag start
      lastSingleTouchPosition.current = {
        x: touches[0].clientX,
        y: touches[0].clientY
      };
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      e.evt.preventDefault();

      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);

      const oldScale = manualZoom !== null ? manualZoom : fitScale;
      const scaleFactor = newDistance / lastTouchDistance.current;
      let newScale = oldScale * scaleFactor;
      newScale = Math.max(0.25, Math.min(3, newScale));

      setManualZoom(newScale);
      lastTouchDistance.current = newDistance;
    } else if (touches.length === 1 && lastSingleTouchPosition.current !== null) {
      // Single finger drag
      e.evt.preventDefault();
      const touch = touches[0];
      const dx = touch.clientX - lastSingleTouchPosition.current.x;
      const dy = touch.clientY - lastSingleTouchPosition.current.y;

      setStagePosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));

      lastSingleTouchPosition.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    }
  }, [fitScale, manualZoom]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    lastSingleTouchPosition.current = null;
    setIsDragging(false);
  }, []);

  // Mouse drag handlers
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    setStagePosition({
      x: e.target.x(),
      y: e.target.y()
    });
  }, []);

  // Animation helper function
  const getAnimationConfig = useCallback((style: number, baseY: number = 0, motionScale: number = 1) => {
    const scaleDuration = (baseDuration: number) => baseDuration / Math.max(0.25, Math.min(3, motionScale));

    switch (style) {
      case 1: // Pulse
        return { duration: scaleDuration(0.6), properties: { scaleX: 1.15, scaleY: 1.15, opacity: 0.8 }, easing: Konva.Easings.EaseInOut };
      case 2: // Bounce
        return { duration: scaleDuration(0.5), properties: { y: baseY - 10 }, easing: Konva.Easings.BounceEaseOut };
      case 3: // Ripple
        return { duration: scaleDuration(1), properties: { opacity: 0.5 }, easing: Konva.Easings.EaseOut };
      case 4: // Flash
        return { duration: scaleDuration(0.3), properties: { opacity: 0.3 }, easing: Konva.Easings.Linear };
      case 5: // Glow
        return { duration: scaleDuration(0.8), properties: { scaleX: 1.08, scaleY: 1.08 }, easing: Konva.Easings.EaseInOut };
      default:
        return null;
    }
  }, []);

  // Run infinite animation for active smart pins
  useEffect(() => {
    if (!stageRef.current || activeSmartPins.length === 0) return;

    const stage = stageRef.current;
    const cleanupFunctions: (() => void)[] = [];

    activeSmartPins.forEach(pinId => {
      const element = elements.find(el => el.id === pinId);
      if (!element || !element.animationStyle || element.animationStyle === 0) return;

      const node = stage.findOne(`#smart-pin-${pinId}`);
      if (!node) return;

      const config = getAnimationConfig(element.animationStyle, node.y(), element.motionScale || 1);
      if (!config) return;

      const originalProps = {
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        opacity: node.opacity(),
        y: node.y(),
      };

      let isRunning = true;

      const runAnimation = () => {
        if (!isRunning) return;

        const forwardTween = new Konva.Tween({
          node,
          duration: config.duration,
          easing: config.easing,
          ...config.properties,
          onFinish: () => {
            if (!isRunning) return;
            const reverseTween = new Konva.Tween({
              node,
              duration: config.duration,
              easing: config.easing,
              scaleX: originalProps.scaleX,
              scaleY: originalProps.scaleY,
              opacity: originalProps.opacity,
              y: originalProps.y,
              onFinish: () => {
                if (isRunning) {
                  setTimeout(runAnimation, 200);
                }
              },
            });
            reverseTween.play();
          },
        });
        forwardTween.play();
      };

      // Start animation after a short delay to ensure node is rendered
      setTimeout(runAnimation, 100);

      cleanupFunctions.push(() => {
        isRunning = false;
        // Reset node to original state
        if (node) {
          node.scaleX(originalProps.scaleX);
          node.scaleY(originalProps.scaleY);
          node.opacity(originalProps.opacity);
          node.y(originalProps.y);
        }
      });
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [activeSmartPins, elements, getAnimationConfig]);

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
      // Static pins - cornered square badge design
      case 'static-pin':
        const staticPinWidth = element.width || 55;
        const staticPinHeight = (element.height || 55) * 0.7;
        const staticPointerHeight = (element.height || 55) * 0.3;
        const staticCornerRadius = 6;
        const staticLabelFontSize = element.pinLabelFontSize || 12;
        const staticLabelColor = element.pinLabelColor || '#ffffff';
        const staticLabelFontWeight = element.pinLabelFontWeight || 'bold';

        return (
          <Group key={element.id} x={element.x} y={element.y}>
            {/* Rectangle body with rounded corners */}
            <Rect
              x={-staticPinWidth / 2}
              y={-staticPinHeight - staticPointerHeight}
              width={staticPinWidth}
              height={staticPinHeight}
              fill={element.fillColor}
              opacity={element.fillOpacity}
              stroke={element.strokeColor}
              strokeWidth={element.strokeWidth}
              cornerRadius={staticCornerRadius}
            />
            {/* Triangular pointer at bottom */}
            <Line
              points={[
                -staticPinWidth * 0.2, -staticPointerHeight,
                staticPinWidth * 0.2, -staticPointerHeight,
                0, 0,
              ]}
              closed={true}
              fill={element.fillColor}
              opacity={element.fillOpacity}
              stroke={element.strokeColor}
              strokeWidth={element.strokeWidth}
              lineJoin="round"
            />
            {/* Cover the stroke line between rectangle and pointer */}
            <Line
              points={[
                -staticPinWidth * 0.18, -staticPointerHeight,
                staticPinWidth * 0.18, -staticPointerHeight,
              ]}
              stroke={element.fillColor}
              strokeWidth={(element.strokeWidth || 2) + 2}
              opacity={element.fillOpacity}
            />
            {/* Pin label inside rectangle */}
            {element.pinLabel && (
              <KonvaText
                text={element.pinLabel}
                x={-staticPinWidth / 2}
                y={-staticPinHeight - staticPointerHeight + (staticPinHeight - staticLabelFontSize) / 2}
                width={staticPinWidth}
                fontSize={staticLabelFontSize}
                fontFamily="Arial, sans-serif"
                fontStyle={staticLabelFontWeight}
                fill={staticLabelColor}
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
  // Design: Classic teardrop pin (like Google Maps) with floating label above
  const renderActiveSmartPin = (element: MapElement) => {
    if (element.type !== 'smart-pin' || !activeSmartPins.includes(element.id)) {
      return null;
    }

    // Build location text (e.g., "Aisle C5, Shelf 1" or "Aisle C5")
    const locationText = selectedProduct?.aisle
      ? `Aisle ${selectedProduct.aisle}${selectedProduct.shelf ? `, Shelf ${selectedProduct.shelf}` : ''}`
      : '';

    // Pin size - use a fixed size for the teardrop
    const pinSize = Math.max(element.width, element.height) * 1.2;
    const pinRadius = pinSize * 0.4;

    // Inner circle (hollow center) position - in the circular top part
    const innerCircleRadius = pinRadius * 0.45;
    const innerCircleY = -pinRadius - pinRadius * 0.2;

    // Use element's colors instead of hardcoded red
    const pinFillColor = element.fillColor || '#ef4444';
    const pinStrokeColor = element.strokeColor || '#dc2626';

    // Floating label dimensions
    const labelFontSize = 12;
    const labelPaddingX = 12;
    const labelPaddingY = 8;
    const labelHeight = labelFontSize + labelPaddingY * 2;
    const textWidth = locationText.length * 7;
    const labelWidth = Math.max(80, textWidth + labelPaddingX * 2);
    const labelY = -pinSize - labelHeight - 12; // Above the pin
    const labelRadius = 6;

    // Arrow pointer connecting label to pin
    const arrowWidth = 10;
    const arrowHeight = 8;

    return (
      <Group key={`active-${element.id}`} id={`smart-pin-${element.id}`} x={element.x} y={element.y}>
        {/* Floating label tooltip above the pin */}
        {locationText && (
          <Group>
            {/* Label background */}
            <Rect
              x={-labelWidth / 2}
              y={labelY}
              width={labelWidth}
              height={labelHeight}
              fill="#1f2937"
              cornerRadius={labelRadius}
              shadowColor="#000"
              shadowBlur={10}
              shadowOffset={{ x: 0, y: 3 }}
              shadowOpacity={0.3}
            />
            {/* Arrow pointer pointing down */}
            <Line
              points={[
                -arrowWidth / 2, labelY + labelHeight,
                arrowWidth / 2, labelY + labelHeight,
                0, labelY + labelHeight + arrowHeight,
              ]}
              closed={true}
              fill="#1f2937"
            />
            {/* Label text */}
            <KonvaText
              text={locationText}
              x={-labelWidth / 2}
              y={labelY + labelPaddingY}
              width={labelWidth}
              fontSize={labelFontSize}
              fontFamily="Arial, sans-serif"
              fontStyle="bold"
              fill="#ffffff"
              align="center"
            />
          </Group>
        )}

        {/* Teardrop pin - outer shape (uses element's colors) */}
        <Circle
          x={0}
          y={innerCircleY}
          radius={pinRadius}
          fill={pinFillColor}
          stroke={pinStrokeColor}
          strokeWidth={element.strokeWidth || 2}
        />

        {/* Bottom triangle point of the teardrop */}
        <Line
          points={[
            -pinRadius * 0.7, innerCircleY + pinRadius * 0.5,
            pinRadius * 0.7, innerCircleY + pinRadius * 0.5,
            0, pinSize * 0.35,
          ]}
          closed={true}
          fill={pinFillColor}
          stroke={pinStrokeColor}
          strokeWidth={element.strokeWidth || 2}
          lineJoin="round"
        />

        {/* Cover the stroke line between circle and triangle */}
        <Line
          points={[
            -pinRadius * 0.65, innerCircleY + pinRadius * 0.5,
            pinRadius * 0.65, innerCircleY + pinRadius * 0.5,
          ]}
          stroke={pinFillColor}
          strokeWidth={4}
        />

        {/* Inner white circle (hollow center) */}
        <Circle
          x={0}
          y={innerCircleY}
          radius={innerCircleRadius}
          fill="#ffffff"
        />
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
            {/* Zoom Controls */}
            <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm border border-border rounded-lg shadow-sm p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleResetZoom}
                title="Fit to View"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>

            {/* Zoom Level Indicator - normalized so BASE_SCALE (0.58) = 100% */}
            <div className="absolute bottom-3 left-14 z-10 bg-white/95 backdrop-blur-sm border border-border rounded-md px-2 py-1 text-xs font-medium shadow-sm">
              {Math.round((scale / BASE_SCALE) * 100)}%
              {manualZoom === null && <span className="text-muted-foreground ml-1">(fit)</span>}
            </div>

            <Stage
              ref={stageRef}
              width={CANVAS_WIDTH * scale}
              height={CANVAS_HEIGHT * scale}
              scaleX={scale}
              scaleY={scale}
              x={stagePosition.x}
              y={stagePosition.y}
              draggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              style={{
                background: '#ffffff',
                touchAction: 'none',
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
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
