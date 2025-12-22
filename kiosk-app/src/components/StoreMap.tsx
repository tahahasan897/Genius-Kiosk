import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, RegularPolygon, Group, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { MapPin, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/data/products';

// Uploaded image interface (matches MapEditor)
interface UploadedImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image: HTMLImageElement | null;
  eraserStrokes: number[][];
}

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
  // New properties for advanced features
  scaleX?: number;
  scaleY?: number;
  strokeStyle?: string;
  gradient?: any;
  textShadow?: any;
  textOutline?: any;
  textGlow?: any;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
}

import { calculateFitToViewScale, getStrokeDash } from './map-editor/types';
import { getGradientProps } from './map-editor/GradientEditor';

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
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
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

  // Load uploaded images from database (published), fall back to localStorage
  useEffect(() => {
    const loadImages = async () => {
      let imagesLoaded = false;

      // First try to load from database (published images)
      try {
        const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map/uploaded-images?published=true`);
        if (response.ok) {
          const data = await response.json();
          const dbImages = data.uploadedImages;

          if (Array.isArray(dbImages) && dbImages.length > 0) {
            // Load images from URLs
            const loadedImages = dbImages.map((imgData: any) => ({
              id: imgData.id,
              url: imgData.url,
              x: imgData.x,
              y: imgData.y,
              width: imgData.width,
              height: imgData.height,
              image: null as HTMLImageElement | null,
              eraserStrokes: imgData.eraserStrokes || [],
            }));

            // Load actual image elements
            loadedImages.forEach((imgData: UploadedImage, index: number) => {
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                setUploadedImages(prev => {
                  const updated = [...prev];
                  if (updated[index]) {
                    updated[index] = { ...updated[index], image: img };
                  }
                  return updated;
                });
              };
              // Handle both relative and absolute URLs
              img.src = imgData.url.startsWith('/') ? `${API_URL}${imgData.url}` : imgData.url;
            });

            setUploadedImages(loadedImages);
            imagesLoaded = true;
          }
        }
      } catch (dbErr) {
        console.warn('Failed to load images from database, falling back to localStorage:', dbErr);
      }

      // Fall back to localStorage if database didn't have images
      if (!imagesLoaded) {
        const savedImagesKey = `map-editor-images-${storeId}`;
        const savedData = localStorage.getItem(savedImagesKey);

        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Load images from URLs
              const loadedImages = parsed.map((imgData: any) => ({
                id: imgData.id,
                url: imgData.url,
                x: imgData.x,
                y: imgData.y,
                width: imgData.width,
                height: imgData.height,
                image: null as HTMLImageElement | null,
                eraserStrokes: imgData.eraserStrokes || [],
              }));

              // Load actual image elements
              loadedImages.forEach((imgData: UploadedImage, index: number) => {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  setUploadedImages(prev => {
                    const updated = [...prev];
                    if (updated[index]) {
                      updated[index] = { ...updated[index], image: img };
                    }
                    return updated;
                  });
                };
                // Handle both relative and absolute URLs
                img.src = imgData.url.startsWith('/') ? `${API_URL}${imgData.url}` : imgData.url;
              });

              setUploadedImages(loadedImages);
            }
          } catch (err) {
            console.error('Error loading uploaded images from localStorage:', err);
          }
        }
      }
    };

    loadImages();
  }, [storeId]);

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/api/products/store/${storeId}/map`);
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
              animationStyle: metadata.animationStyle ?? 0,
              motionScale: metadata.motionScale ?? 1,
              pinLabel: metadata.pinLabel ?? '',
              pinLabelFontSize: metadata.pinLabelFontSize ?? 16,
              pinLabelColor: metadata.pinLabelColor ?? '#ffffff',
              pinLabelFontWeight: metadata.pinLabelFontWeight ?? 'normal',
              showNameOn: metadata.showNameOn ?? 'both',
              // Transform properties
              scaleX: metadata.scaleX ?? 1,
              scaleY: metadata.scaleY ?? 1,
              // Stroke style
              strokeStyle: metadata.strokeStyle ?? 'solid',
              // Gradient
              gradient: metadata.gradient,
              // Text effects
              textShadow: metadata.textShadow,
              textOutline: metadata.textOutline,
              textGlow: metadata.textGlow,
              // Additional text properties
              letterSpacing: metadata.letterSpacing ?? 0,
              lineHeight: metadata.lineHeight ?? 1,
              textDecoration: metadata.textDecoration ?? 'none',
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

  // Smooth zoom transition to selected smart pin
  useEffect(() => {
    if (!selectedProduct?.mapElementId || !stageRef.current || !containerRef.current) return;

    // Find the pin element
    const pinElement = elements.find(
      el => el.id === selectedProduct.mapElementId?.toString() && el.type === 'smart-pin'
    );
    if (!pinElement) return;

    const stage = stageRef.current;
    const container = containerRef.current;

    // Target zoom level (zoom in closer to the pin)
    const targetScale = Math.min(1.2, fitScale * 2); // Zoom in 2x from fit, max 1.2

    // Calculate center position to focus on the pin
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Pin position in canvas coordinates
    const pinX = pinElement.x;
    const pinY = pinElement.y;

    // Calculate stage position to center the pin
    // Formula accounts for flex-centered Stage: offset = (canvasCenter - pinPosition) * scale
    const targetX = (CANVAS_WIDTH / 2 - pinX) * targetScale;
    const targetY = (CANVAS_HEIGHT / 2 - pinY) * targetScale;

    // Get current values
    const currentScale = scale;
    const currentX = stagePosition.x;
    const currentY = stagePosition.y;

    // Animate using Konva Animation
    const animationDuration = 0.6;

    const anim = new Konva.Animation((frame) => {
      if (!frame) return;

      const progress = Math.min(frame.time / (animationDuration * 1000), 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const newScale = currentScale + (targetScale - currentScale) * easeProgress;
      const newX = currentX + (targetX - currentX) * easeProgress;
      const newY = currentY + (targetY - currentY) * easeProgress;

      setScale(newScale);
      setManualZoom(newScale);
      setStagePosition({ x: newX, y: newY });

      if (progress >= 1) {
        anim.stop();
      }
    }, stage.getLayers()[0]);

    anim.start();

    return () => {
      anim.stop();
    };
  }, [selectedProduct?.mapElementId, elements, fitScale]);

  // Calculate scale to fit container using shared utility
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const newFitScale = calculateFitToViewScale(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        );
        setFitScale(newFitScale);
        // Only set scale when manualZoom is null (to avoid interfering with animations)
        if (manualZoom === null) {
          setScale(newFitScale);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [manualZoom]);

  // Apply manual zoom when it changes (separate from fit calculation)
  useEffect(() => {
    if (manualZoom !== null) {
      setScale(manualZoom);
    }
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

  // Run animations for static pins (always animate when they have an animation style)
  useEffect(() => {
    if (!stageRef.current) return;

    const staticPinsWithAnimation = elements.filter(
      el => (el.type === 'static-pin' || el.type === 'device-pin') && el.visible && el.animationStyle && el.animationStyle > 0
    );

    if (staticPinsWithAnimation.length === 0) return;

    const stage = stageRef.current;
    const cleanupFunctions: (() => void)[] = [];

    staticPinsWithAnimation.forEach(element => {
      const nodeId = element.type === 'device-pin' ? `#device-pin-${element.id}` : `#static-pin-${element.id}`;
      const node = stage.findOne(nodeId);
      if (!node) return;

      const config = getAnimationConfig(element.animationStyle!, node.y(), element.motionScale || 1);
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
  }, [elements, getAnimationConfig]);

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
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
    };

    switch (element.type) {
      case 'rectangle':
        return (
          <Rect
            key={element.id}
            {...commonProps}
            width={element.width}
            height={element.height}
            {...getGradientProps(element as any)}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            cornerRadius={element.cornerRadius}
            dash={getStrokeDash(element.strokeStyle)}
          />
        );
      case 'circle':
        return (
          <Circle
            key={element.id}
            {...commonProps}
            radius={element.width / 2}
            {...getGradientProps(element as any)}
            opacity={element.fillOpacity}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            dash={getStrokeDash(element.strokeStyle)}
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
            dash={getStrokeDash(element.strokeStyle)}
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
            dash={getStrokeDash(element.strokeStyle)}
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
            dash={getStrokeDash(element.strokeStyle)}
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
            dash={getStrokeDash(element.strokeStyle)}
          />
        );
      case 'line':
        return (
          <Line
            key={element.id}
            points={element.points || [0, 0, 100, 0]}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            dash={getStrokeDash(element.strokeStyle)}
          />
        );
      case 'arrow':
        return (
          <Line
            key={element.id}
            points={element.points || [0, 0, 100, 0]}
            stroke={element.strokeColor}
            strokeWidth={element.strokeWidth}
            dash={getStrokeDash(element.strokeStyle)}
          />
        );
      case 'text':
        // Calculate text effects
        const storeTextShadowEnabled = element.textShadow?.enabled || element.textGlow?.enabled;
        const storeTextShadowColor = element.textGlow?.enabled
          ? element.textGlow.color
          : (element.textShadow?.color || '#000000');
        const storeTextShadowBlur = element.textGlow?.enabled
          ? element.textGlow.blur
          : (element.textShadow?.blur || 0);
        const storeTextShadowOffsetX = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetX || 0);
        const storeTextShadowOffsetY = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetY || 0);

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
            letterSpacing={element.letterSpacing || 0}
            lineHeight={element.lineHeight || 1}
            textDecoration={element.textDecoration || 'none'}
            shadowEnabled={storeTextShadowEnabled}
            shadowColor={storeTextShadowColor}
            shadowBlur={storeTextShadowBlur}
            shadowOffsetX={storeTextShadowOffsetX}
            shadowOffsetY={storeTextShadowOffsetY}
            stroke={element.textOutline?.enabled ? element.textOutline.color : undefined}
            strokeWidth={element.textOutline?.enabled ? element.textOutline.width : 0}
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
            dash={getStrokeDash(element.strokeStyle)}
          />
        );
      // Static pins - cornered square badge design
      case 'static-pin':
        const staticPinWidth = element.width || 55;
        const staticPinHeight = (element.height || 55) * 0.7;
        const staticPointerHeight = (element.height || 55) * 0.3;
        const staticCornerRadius = 6;
        const staticLabelFontSize = element.pinLabelFontSize || 16;
        const staticLabelColor = element.pinLabelColor || '#ffffff';
        const staticLabelFontWeight = element.pinLabelFontWeight || 'normal';
        const staticLabelFontFamily = element.pinLabelFontFamily || 'Inter, system-ui, -apple-system, sans-serif';

        return (
          <Group key={element.id} id={`static-pin-${element.id}`} x={element.x} y={element.y}>
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
                y={-staticPinHeight - staticPointerHeight}
                width={staticPinWidth}
                height={staticPinHeight}
                fontSize={staticLabelFontSize}
                fontFamily={staticLabelFontFamily}
                fontStyle={staticLabelFontWeight}
                fill={staticLabelColor}
                align="center"
                verticalAlign="middle"
              />
            )}
          </Group>
        );
      case 'device-pin':
        // Kiosk/screen design with monitor and stand (no pointer)
        const devicePinWidth = element.width || 50;
        const devicePinHeight = element.height || 60;
        const screenHeight = devicePinHeight * 0.70;
        const standHeight = devicePinHeight * 0.30;
        const screenCornerRadius = 4;
        const deviceLabelFontSize = element.pinLabelFontSize || 14;
        const deviceLabelColor = element.pinLabelColor || '#ffffff';
        const deviceLabelFontWeight = element.pinLabelFontWeight || 'normal';
        const deviceLabelFontFamily = element.pinLabelFontFamily || 'Inter, system-ui, -apple-system, sans-serif';
        // Use a single color for the entire device pin (no separate stroke)
        const deviceFillColor = element.fillColor || '#6366f1';
        const deviceFillOpacity = element.fillOpacity ?? 1;

        return (
          <Group key={element.id} id={`device-pin-${element.id}`} x={element.x} y={element.y}>
            {/* Screen/monitor body - no stroke, single color */}
            <Rect
              x={-devicePinWidth / 2}
              y={-screenHeight - standHeight}
              width={devicePinWidth}
              height={screenHeight}
              fill={deviceFillColor}
              opacity={deviceFillOpacity}
              cornerRadius={screenCornerRadius}
            />
            {/* Screen inner area (darker overlay for depth) */}
            <Rect
              x={-devicePinWidth / 2 + 4}
              y={-screenHeight - standHeight + 4}
              width={devicePinWidth - 8}
              height={screenHeight - 8}
              fill="#000000"
              opacity={0.25}
              cornerRadius={2}
            />
            {/* Stand neck - same color as body */}
            <Rect
              x={-devicePinWidth * 0.1}
              y={-standHeight}
              width={devicePinWidth * 0.2}
              height={standHeight * 0.6}
              fill={deviceFillColor}
              opacity={deviceFillOpacity}
            />
            {/* Stand base - same color as body */}
            <Rect
              x={-devicePinWidth * 0.35}
              y={-standHeight * 0.4}
              width={devicePinWidth * 0.7}
              height={standHeight * 0.4}
              fill={deviceFillColor}
              opacity={deviceFillOpacity}
              cornerRadius={2}
            />
            {/* Pin label inside screen */}
            {element.pinLabel && (
              <KonvaText
                text={element.pinLabel}
                x={-devicePinWidth / 2 + 4}
                y={-screenHeight - standHeight + 4}
                width={devicePinWidth - 8}
                height={screenHeight - 8}
                fontSize={deviceLabelFontSize}
                fontFamily={deviceLabelFontFamily}
                fontStyle={deviceLabelFontWeight}
                fill={deviceLabelColor}
                align="center"
                verticalAlign="middle"
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

    // Build location text (e.g., "C5-1" or "C5")
    const locationText = selectedProduct?.aisle
      ? `${selectedProduct.aisle}${selectedProduct.shelf ? `-${selectedProduct.shelf}` : ''}`
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

    // Floating label dimensions - scale with pin size (1.5x the pin)
    const labelScale = 1.5;
    const baseLabelFontSize = 12;
    const labelFontSize = Math.max(baseLabelFontSize, pinSize * 0.4 * labelScale);
    const labelPaddingX = Math.max(12, pinSize * 0.3);
    const labelPaddingY = Math.max(8, pinSize * 0.2);
    const labelHeight = labelFontSize + labelPaddingY * 2;
    const charWidth = labelFontSize * 0.6; // Approximate character width based on font size
    const textWidth = locationText.length * charWidth;
    const labelWidth = Math.max(pinSize * labelScale, textWidth + labelPaddingX * 2);
    const labelY = -pinSize - labelHeight - 12; // Above the pin
    const labelRadius = Math.max(6, pinSize * 0.15);

    // Arrow pointer connecting label to pin - scale with pin size
    const arrowWidth = Math.max(10, pinSize * 0.25);
    const arrowHeight = Math.max(8, pinSize * 0.2);

    return (
      <Group key={`active-${element.id}`} x={element.x} y={element.y}>
        {/* Floating label tooltip above the pin - NOT animated */}
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

        {/* Animated pin group - only this gets animated */}
        <Group id={`smart-pin-${element.id}`}>
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
  if (!mapImageUrl && elements.length === 0 && uploadedImages.length === 0) {
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
                {/* Background image (legacy) - only show if no uploaded images exist */}
                {loadedImage && uploadedImages.length === 0 && (
                  <KonvaImage
                    image={loadedImage}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    opacity={0.9}
                  />
                )}

                {/* Uploaded images (with eraser strokes support) */}
                {uploadedImages.map((uploadedImg) => (
                  uploadedImg.image && (
                    <Group key={uploadedImg.id} x={uploadedImg.x} y={uploadedImg.y}>
                      <KonvaImage
                        image={uploadedImg.image}
                        width={uploadedImg.width}
                        height={uploadedImg.height}
                        opacity={0.9}
                      />
                      {/* Eraser strokes - use destination-out to cut from the image */}
                      {/* Note: eraser Lines must be direct children of the image Group (no wrapper) for globalCompositeOperation to work */}
                      {uploadedImg.eraserStrokes && uploadedImg.eraserStrokes.map((stroke: number[], strokeIndex: number) => {
                        // Extract eraser size (last element) from stroke array
                        const strokeSize = stroke[stroke.length - 1] || 40;
                        const points = stroke.slice(0, -1); // All but last element are coordinates
                        return (
                          <Line
                            key={`eraser-${uploadedImg.id}-${strokeIndex}`}
                            points={points}
                            stroke="#ffffff"
                            strokeWidth={strokeSize}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            globalCompositeOperation="destination-out"
                          />
                        );
                      })}
                    </Group>
                  )
                ))}

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
