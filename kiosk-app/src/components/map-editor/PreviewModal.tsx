import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, RegularPolygon, Group, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { X, Search, MapPin, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MapElement, AnimationStyle } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, calculateFitToViewScale, getStrokeDash } from './types';
import { getGradientProps } from './GradientEditor';

interface PreviewProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  imageUrl?: string;
  aisle?: string;
  shelf?: string;
  mapElementId?: number;
}

interface UploadedImage {
  id: string;
  url: string;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  width: number;
  height: number;
  eraserStrokes: number[][];
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: number;
  elements: MapElement[];
  mapImageUrl: string | null;
  uploadedImages?: UploadedImage[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PreviewModal = ({ isOpen, onClose, storeId, elements, mapImageUrl, uploadedImages = [] }: PreviewModalProps) => {
  const [products, setProducts] = useState<PreviewProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PreviewProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSmartPins, setActiveSmartPins] = useState<string[]>([]);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const animationTweensRef = useRef<Map<string, { forward: Konva.Tween | null; reverse: Konva.Tween | null }>>(new Map());

  // Load map image
  const [loadedImage] = useImage(mapImageUrl ? `${API_URL}${mapImageUrl}` : '');

  // Fetch products with map links
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    } else {
      // Reset state when modal closes
      setSelectedProduct(null);
      setActiveSmartPins([]);
      setSearchTerm('');
    }
  }, [isOpen, storeId]);

  const fetchProducts = async (search: string = '') => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/stores/${storeId}/products/preview?search=${encodeURIComponent(search)}`
      );
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchProducts(searchTerm);
  };

  // Update active smart pins when product is selected
  useEffect(() => {
    if (selectedProduct?.mapElementId) {
      setActiveSmartPins([selectedProduct.mapElementId.toString()]);
    } else {
      setActiveSmartPins([]);
    }
  }, [selectedProduct]);

  // Update scale based on container - uses shared utility for consistency
  // Uses 0 padding to match live map exactly (grid area = capture area)
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const newScale = calculateFitToViewScale(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
          0 // Match live map - no padding for consistent zoom
        );
        setScale(newScale);
      }
    };

    if (isOpen) {
      // Small delay to ensure container is rendered
      setTimeout(updateScale, 100);
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [isOpen]);

  // Animation helper function
  const getAnimationConfig = useCallback((style: AnimationStyle, baseY: number = 0, motionScale: number = 1) => {
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

      const config = getAnimationConfig(element.animationStyle as AnimationStyle, node.y(), element.motionScale || 1);
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
    if (!stageRef.current || !isOpen) return;

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

      const config = getAnimationConfig(element.animationStyle as AnimationStyle, node.y(), element.motionScale || 1);
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
  }, [isOpen, elements, getAnimationConfig]);

  // Shape helper functions
  const getTrapezoidPoints = (width: number, height: number): number[] => {
    const topOffset = width * 0.2;
    return [topOffset, 0, width - topOffset, 0, width, height, 0, height];
  };

  const getParallelogramPoints = (width: number, height: number): number[] => {
    const offset = width * 0.2;
    return [offset, 0, width, 0, width - offset, height, 0, height];
  };

  // Teardrop pin shape - classic map marker style like Google Maps
  const getTeardropPinSize = (element: MapElement) => {
    const size = Math.max(element.width, element.height) * 1.2;
    const radius = size * 0.4;
    return { size, radius };
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
            {...getGradientProps(element)}
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
            {...getGradientProps(element)}
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
        const previewTextShadowEnabled = element.textShadow?.enabled || element.textGlow?.enabled;
        const previewTextShadowColor = element.textGlow?.enabled
          ? element.textGlow.color
          : (element.textShadow?.color || '#000000');
        const previewTextShadowBlur = element.textGlow?.enabled
          ? element.textGlow.blur
          : (element.textShadow?.blur || 0);
        const previewTextShadowOffsetX = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetX || 0);
        const previewTextShadowOffsetY = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetY || 0);

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
            shadowEnabled={previewTextShadowEnabled}
            shadowColor={previewTextShadowColor}
            shadowBlur={previewTextShadowBlur}
            shadowOffsetX={previewTextShadowOffsetX}
            shadowOffsetY={previewTextShadowOffsetY}
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
      case 'static-pin':
        // Cornered square badge design with pointer at bottom
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

        return (
          <Group key={element.id} id={`device-pin-${element.id}`} x={element.x} y={element.y}>
            {/* Screen/monitor body */}
            <Rect
              x={-devicePinWidth / 2}
              y={-screenHeight - standHeight}
              width={devicePinWidth}
              height={screenHeight}
              fill={element.fillColor}
              opacity={element.fillOpacity}
              stroke={element.strokeColor}
              strokeWidth={element.strokeWidth}
              cornerRadius={screenCornerRadius}
            />
            {/* Screen inner area (darker) */}
            <Rect
              x={-devicePinWidth / 2 + 4}
              y={-screenHeight - standHeight + 4}
              width={devicePinWidth - 8}
              height={screenHeight - 8}
              fill="#000000"
              opacity={0.3}
              cornerRadius={2}
            />
            {/* Stand neck */}
            <Rect
              x={-devicePinWidth * 0.1}
              y={-standHeight}
              width={devicePinWidth * 0.2}
              height={standHeight * 0.6}
              fill={element.strokeColor}
              opacity={element.fillOpacity}
            />
            {/* Stand base */}
            <Rect
              x={-devicePinWidth * 0.35}
              y={-standHeight * 0.4}
              width={devicePinWidth * 0.7}
              height={standHeight * 0.4}
              fill={element.strokeColor}
              opacity={element.fillOpacity}
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

  // Render active smart pin with teardrop design and floating label
  const renderActiveSmartPin = (element: MapElement) => {
    if (element.type !== 'smart-pin' || !activeSmartPins.includes(element.id)) {
      return null;
    }

    // Build location text (e.g., "Aisle C5, Shelf 1" or "Aisle C5")
    const locationText = selectedProduct?.aisle
      ? `Aisle ${selectedProduct.aisle}${selectedProduct.shelf ? `, Shelf ${selectedProduct.shelf}` : ''}`
      : '';

    // Pin size calculations
    const pinSize = Math.max(element.width, element.height) * 1.2;
    const pinRadius = pinSize * 0.4;
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
    const labelY = -pinSize - labelHeight - 12;
    const labelRadius = 6;
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

        {/* Teardrop pin - outer circle (uses element's colors) */}
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[1400px] h-[850px] p-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Preview Store Map</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100% - 52px)' }}>
          {/* Product Selector Sidebar */}
          <div className="w-72 border-r bg-muted/30 flex flex-col flex-shrink-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-1">Select a Product</h3>
              <p className="text-xs text-muted-foreground">
                Choose a product to see how the map highlights its location
              </p>
            </div>

            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Product List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No products linked to map pins yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Link products to smart pins in the editor
                    </p>
                  </div>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedProduct?.id === product.id
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-transparent hover:bg-muted hover:border-border'
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.aisle ? `Aisle ${product.aisle}` : 'No aisle'}
                        {product.shelf ? `, Shelf ${product.shelf}` : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Clear Selection */}
            {selectedProduct && (
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                  className="w-full"
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>

          {/* Map Preview */}
          <div
            className="flex-1 bg-muted/10 flex flex-col overflow-hidden"
          >
            {/* Map Header */}
            <div className="p-3 border-b bg-background/80 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-sm">Consumer View</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct
                    ? `Showing: ${selectedProduct.name}`
                    : 'Select a product to see its location'}
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                {selectedProduct && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-red-500" />
                    <span>Your Product</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-green-500" />
                  <span>Facility</span>
                </div>
              </div>
            </div>

            {/* Canvas Container - render at scaled resolution for crisp display */}
            {/* Uses same structure as StoreMap for consistent zoom behavior */}
            <div
              ref={containerRef}
              className="flex-1 flex items-center justify-center overflow-hidden bg-muted/20"
            >
              <div
                className="bg-white shadow-lg border overflow-hidden"
              >
                <Stage
                  ref={stageRef}
                  width={CANVAS_WIDTH * scale}
                  height={CANVAS_HEIGHT * scale}
                  scaleX={scale}
                  scaleY={scale}
                  style={{ background: '#ffffff' }}
                >
                  <Layer>
                    {loadedImage && (
                      <KonvaImage
                        image={loadedImage}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                      />
                    )}

                    {/* Render uploaded images from the editor */}
                    {uploadedImages.map((uploadedImg) => (
                      uploadedImg.image && (
                        <Group
                          key={uploadedImg.id}
                          x={uploadedImg.x}
                          y={uploadedImg.y}
                        >
                          <KonvaImage
                            image={uploadedImg.image}
                            width={uploadedImg.width}
                            height={uploadedImg.height}
                            opacity={0.9}
                          />
                          {/* Eraser strokes - use destination-out to cut from the image */}
                          {uploadedImg.eraserStrokes.map((stroke, i) => {
                            const strokeSize = stroke[stroke.length - 1];
                            const points = stroke.slice(0, -1);
                            return (
                              <Line
                                key={`eraser-${uploadedImg.id}-${i}`}
                                points={points}
                                stroke="#ffffff"
                                strokeWidth={strokeSize}
                                lineCap="round"
                                lineJoin="round"
                                globalCompositeOperation="destination-out"
                              />
                            );
                          })}
                        </Group>
                      )
                    ))}

                    {/* Render non-smart-pin elements */}
                    {elements
                      .filter(el => el.visible && el.type !== 'smart-pin')
                      .sort((a, b) => a.zIndex - b.zIndex)
                      .map(renderElement)}

                    {/* Render smart pins (only active ones) */}
                    {elements
                      .filter(el => el.type === 'smart-pin' && el.visible)
                      .map(renderActiveSmartPin)}
                  </Layer>
                </Stage>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewModal;
