import { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown, Eraser, Undo2, Lock, Unlock, Link2, FlipHorizontal2, FlipVertical2, Crop, RotateCw } from 'lucide-react';
import type { MapElement, AnimationStyle, Tool, StrokeStyle, TextDecoration, Gradient } from './types';
import { animationStyleLabels, STROKE_DASH_PATTERNS } from './types';
import GradientEditor from './GradientEditor';
import ColorPicker from './ColorPicker';

// Uploaded image data type
interface UploadedImageData {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  eraserStrokes: number[][];
}

interface PropertiesPanelProps {
  element: MapElement | null;
  elements: MapElement[]; // Full list for z-index calculations
  onUpdateElement: (id: string, updates: Partial<MapElement>) => void;
  // Flip handlers
  onFlipHorizontal?: (id: string) => void;
  onFlipVertical?: (id: string) => void;
  // Eyedropper
  onActivateEyedropper?: (elementId: string, property: 'fillColor' | 'strokeColor' | 'pinLabelColor' | 'labelColor') => void;
  // Eraser props
  activeTool?: Tool;
  eraserSize?: number;
  onEraserSizeChange?: (size: number) => void;
  onClearEraserStrokes?: () => void;
  hasEraserStrokes?: boolean;
  // Image props
  selectedImageIds?: string[];
  uploadedImages?: UploadedImageData[];
  onUpdateImage?: (id: string, updates: Partial<UploadedImageData>) => void;
  isBackgroundImageSelected?: boolean;
  backgroundImagePosition?: { x: number; y: number };
  backgroundImageSize?: { width: number; height: number };
  backgroundImageRotation?: number;
  backgroundImageOpacity?: number;
  onUpdateBackgroundImage?: (updates: Partial<{ x: number; y: number; width: number; height: number; rotation: number; opacity: number }>) => void;
  // Crop mode
  cropModeEnabled?: boolean;
  onCropModeChange?: (enabled: boolean) => void;
  onApplyCrop?: () => void;
  cropBox?: { imageId: string | 'background'; x: number; y: number; width: number; height: number } | null;
}

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Impact',
  'Comic Sans MS',
];

// Elements that support fill color
const fillElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram', 'smart-pin', 'static-pin', 'device-pin'];
// Elements that support corner radius
const cornerRadiusElements = ['rectangle', 'trapezoid', 'parallelogram', 'text'];
// Elements that are line-based (no fill)
const lineElements = ['line', 'arrow', 'freehand'];
// Elements that need size controls
const sizeElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram', 'text'];
// Pin elements
const pinElements = ['smart-pin', 'static-pin', 'device-pin'];

const PropertiesPanel = ({
  element,
  elements,
  onUpdateElement,
  onFlipHorizontal,
  onFlipVertical,
  onActivateEyedropper,
  activeTool,
  eraserSize = 20,
  onEraserSizeChange,
  onClearEraserStrokes,
  hasEraserStrokes = false,
  // Image props
  selectedImageIds = [],
  uploadedImages = [],
  onUpdateImage,
  isBackgroundImageSelected = false,
  backgroundImagePosition,
  backgroundImageSize,
  backgroundImageRotation = 0,
  backgroundImageOpacity = 0.9,
  onUpdateBackgroundImage,
  // Crop mode
  cropModeEnabled = false,
  onCropModeChange,
  onApplyCrop,
  cropBox,
}: PropertiesPanelProps) => {
  // Aspect ratio lock state
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);

  // Throttled color update refs - MUST be declared before any conditional returns
  const pendingColorRef = useRef<string | null>(null);
  const colorFrameRef = useRef<number | null>(null);

  // Update aspect ratio when element changes or lock is enabled
  useEffect(() => {
    if (element && aspectRatioLocked && element.width && element.height) {
      setAspectRatio(element.width / element.height);
    }
  }, [element?.id, aspectRatioLocked]);

  // Reset aspect ratio lock when selecting different element
  useEffect(() => {
    setAspectRatioLocked(false);
  }, [element?.id]);

  // Cleanup on unmount - MUST be declared before any conditional returns
  useEffect(() => {
    return () => {
      if (colorFrameRef.current !== null) {
        cancelAnimationFrame(colorFrameRef.current);
      }
    };
  }, []);

  // Show eraser settings when eraser tool is active
  if (activeTool === 'eraser') {
    return (
      <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-sm truncate">Eraser Settings</h3>
          <p className="text-xs text-muted-foreground">Paint to erase parts of the background</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Eraser Size: {eraserSize}px</Label>
              <Slider
                value={[eraserSize]}
                onValueChange={([value]) => onEraserSizeChange?.(value)}
                min={5}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>

            {/* Eraser Preview */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Preview</Label>
              <div className="w-full h-24 bg-muted/30 rounded-lg flex items-center justify-center border border-border">
                <div
                  className="rounded-full bg-white border-2 border-gray-300 shadow-sm"
                  style={{ width: eraserSize, height: eraserSize }}
                />
              </div>
            </div>

            <Separator />

            {/* Clear all eraser strokes */}
            {hasEraserStrokes && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Eraser Actions</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onClearEraserStrokes}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo All Eraser Strokes
                </Button>
              </div>
            )}

            {/* Instructions */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> Click and drag on the background image to erase parts of it.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Get selected image for image properties
  const selectedImage = selectedImageIds.length === 1
    ? uploadedImages.find(img => img.id === selectedImageIds[0])
    : null;

  // Show image properties when an image is selected (background or uploaded)
  if (!element && (isBackgroundImageSelected || selectedImage)) {
    const isBackground = isBackgroundImageSelected;
    const imgX = isBackground ? (backgroundImagePosition?.x ?? 0) : (selectedImage?.x ?? 0);
    const imgY = isBackground ? (backgroundImagePosition?.y ?? 0) : (selectedImage?.y ?? 0);
    const imgWidth = isBackground ? (backgroundImageSize?.width ?? 0) : (selectedImage?.width ?? 0);
    const imgHeight = isBackground ? (backgroundImageSize?.height ?? 0) : (selectedImage?.height ?? 0);
    const imgRotation = isBackground ? backgroundImageRotation : (selectedImage?.rotation ?? 0);
    const imgOpacity = isBackground ? backgroundImageOpacity : (selectedImage?.opacity ?? 0.9);

    const handleImageUpdate = (updates: Partial<{ x: number; y: number; width: number; height: number; rotation: number; opacity: number }>) => {
      if (isBackground && onUpdateBackgroundImage) {
        onUpdateBackgroundImage(updates);
      } else if (selectedImage && onUpdateImage) {
        onUpdateImage(selectedImage.id, updates);
      }
    };

    return (
      <div className="h-full bg-card border-l border-border overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">
            {isBackground ? 'Background Image' : 'Image Properties'}
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Crop Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Crop Mode</Label>
              <Button
                variant={cropModeEnabled ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => onCropModeChange?.(!cropModeEnabled)}
              >
                <Crop className="h-4 w-4 mr-2" />
                {cropModeEnabled ? 'Crop Mode On' : 'Enable Crop Mode'}
              </Button>
              {cropModeEnabled && cropBox && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Resize the crop box on the canvas, then click Apply to crop the image.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => onApplyCrop?.()}
                    >
                      Apply Crop
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onCropModeChange?.(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Position */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Position</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">X</Label>
                  <Input
                    type="number"
                    value={Math.round(imgX)}
                    onChange={(e) => handleImageUpdate({ x: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Y</Label>
                  <Input
                    type="number"
                    value={Math.round(imgY)}
                    onChange={(e) => handleImageUpdate({ y: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <Input
                    type="number"
                    value={Math.round(imgWidth)}
                    onChange={(e) => handleImageUpdate({ width: parseFloat(e.target.value) || 50 })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    value={Math.round(imgHeight)}
                    onChange={(e) => handleImageUpdate({ height: parseFloat(e.target.value) || 50 })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Rotation</Label>
                <span className="text-xs text-muted-foreground">{Math.round(imgRotation)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[imgRotation]}
                  onValueChange={([value]) => handleImageUpdate({ rotation: value })}
                  min={0}
                  max={360}
                  step={1}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleImageUpdate({ rotation: 0 })}
                  title="Reset rotation"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Opacity</Label>
                <span className="text-xs text-muted-foreground">{Math.round(imgOpacity * 100)}%</span>
              </div>
              <Slider
                value={[imgOpacity * 100]}
                onValueChange={([value]) => handleImageUpdate({ opacity: value / 100 })}
                min={10}
                max={100}
                step={1}
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!element) {
    return (
      <div className="h-full bg-card border-l border-border p-4 overflow-hidden">
        <p className="text-sm text-muted-foreground text-center py-8 break-words">
          Select an element to edit its properties
        </p>
      </div>
    );
  }

  const update = (updates: Partial<MapElement>) => {
    onUpdateElement(element.id, updates);
  };

  // Throttled color update - uses refs declared above (before early returns)
  const throttledColorUpdate = (color: string) => {
    pendingColorRef.current = color;

    if (colorFrameRef.current === null) {
      colorFrameRef.current = requestAnimationFrame(() => {
        if (pendingColorRef.current) {
          onUpdateElement(element.id, { fillColor: pendingColorRef.current });
          pendingColorRef.current = null;
        }
        colorFrameRef.current = null;
      });
    }
  };

  const isTextElement = element.type === 'text';
  const isPin = pinElements.includes(element.type);
  const isSmartPin = element.type === 'smart-pin';
  const isStaticPin = element.type === 'static-pin';
  const isDevicePin = element.type === 'device-pin';
  const isPinWithLabel = isStaticPin || isDevicePin; // Pins that have editable labels
  // Pins have their own "Pin Color" section, so exclude them from the general Fill Color section
  const showFill = fillElements.includes(element.type) && !isPin;
  const showCornerRadius = cornerRadiusElements.includes(element.type);
  const showSize = sizeElements.includes(element.type);
  const showPolygonSides = element.type === 'polygon';
  const showStroke = !isTextElement && !isPin; // All shapes except text and pins have stroke
  const showLabelProperties = !isTextElement && !isPin && !lineElements.includes(element.type); // Shapes that can have labels

  return (
    <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h3 className="font-semibold text-sm truncate">Properties</h3>
        <p className="text-xs text-muted-foreground capitalize truncate">{element.type}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Pin Properties */}
          {isPin && (
            <>
              <div className="space-y-4">
                {/* Pin Label - for static and device pins */}
                {isPinWithLabel && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Pin Label</Label>
                      <Input
                        value={element.pinLabel || ''}
                        onChange={(e) => update({ pinLabel: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="e.g., Restroom, Cashier, Exit..."
                      />
                      <p className="text-[10px] text-muted-foreground">
                        This label will be displayed on the pin
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Label Font Size: {element.pinLabelFontSize || 12}px</Label>
                      <Slider
                        value={[element.pinLabelFontSize || 12]}
                        onValueChange={([value]) => update({ pinLabelFontSize: value })}
                        min={6}
                        max={24}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Label Weight</Label>
                      <Select
                        value={element.pinLabelFontWeight || 'normal'}
                        onValueChange={(value: 'normal' | 'bold') => update({ pinLabelFontWeight: value })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <ColorPicker
                      label="Label Color"
                      color={element.pinLabelColor || '#ffffff'}
                      onChange={(color) => update({ pinLabelColor: color })}
                      onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'pinLabelColor') : undefined}
                    />
                  </>
                )}

                {/* Animation Style */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Animation Style</Label>
                  <Select
                    value={String(element.animationStyle ?? 0)}
                    onValueChange={(value) => update({ animationStyle: Number(value) as AnimationStyle })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(animationStyleLabels) as [string, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Select an animation to preview it. Animation plays when pin is active on consumer map.
                  </p>
                </div>

                {/* Animation Speed (Motion Scale) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Animation Speed: {(element.motionScale ?? 1).toFixed(1)}x</Label>
                  <Slider
                    value={[element.motionScale ?? 1]}
                    onValueChange={([value]) => update({ motionScale: value })}
                    min={0.25}
                    max={3}
                    step={0.25}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                {/* Pin Color */}
                <ColorPicker
                  label="Pin Color"
                  color={element.fillColor || '#6366f1'}
                  onChange={(color) => update({ fillColor: color })}
                  onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'fillColor') : undefined}
                />

                {isSmartPin && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Tip:</span> Use the "Links" tab to connect products to this Smart Pin.
                    </p>
                  </div>
                )}
              </div>

              <Separator />
            </>
          )}

          {/* Label Properties - For shapes that have labels */}
          {showLabelProperties && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label</Label>
                  <Input
                    value={element.name || ''}
                    onChange={(e) => update({ name: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Enter label..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label Font Size: {element.labelFontSize || 28}px</Label>
                  <Slider
                    value={[element.labelFontSize || 28]}
                    onValueChange={([value]) => update({ labelFontSize: value })}
                    min={8}
                    max={72}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label Font</Label>
                  <Select
                    value={element.labelFontFamily || 'Arial'}
                    onValueChange={(value) => update({ labelFontFamily: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map((font) => (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label Weight</Label>
                  <Select
                    value={element.labelFontWeight || 'normal'}
                    onValueChange={(value: 'normal' | 'bold') => update({ labelFontWeight: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ColorPicker
                  label="Label Color"
                  color={element.labelColor || '#000000'}
                  onChange={(color) => update({ labelColor: color })}
                  onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'labelColor') : undefined}
                />
              </div>

              <Separator />
            </>
          )}

          {/* Text Content - Only for text elements */}
          {isTextElement && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Text Content</Label>
                <Textarea
                  value={element.text || ''}
                  onChange={(e) => update({ text: e.target.value })}
                  className="text-sm min-h-[80px] resize-y"
                  placeholder="Enter your text..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Font Family</Label>
                <Select
                  value={element.fontFamily || 'Arial'}
                  onValueChange={(value) => update({ fontFamily: value })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontFamilies.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Font Size: {element.fontSize || 24}px</Label>
                <Slider
                  value={[element.fontSize || 24]}
                  onValueChange={([value]) => update({ fontSize: value })}
                  min={8}
                  max={120}
                  step={1}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Weight</Label>
                  <Select
                    value={element.fontWeight || 'normal'}
                    onValueChange={(value: 'normal' | 'bold') => update({ fontWeight: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Align</Label>
                  <Select
                    value={element.textAlign || 'center'}
                    onValueChange={(value: 'left' | 'center' | 'right') => update({ textAlign: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ColorPicker
                label="Text Color"
                color={element.fillColor}
                onChange={(color) => update({ fillColor: color })}
                onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'fillColor') : undefined}
              />

              {/* Typography Section */}
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-medium">Typography</Label>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Letter Spacing: {element.letterSpacing || 0}px
                  </Label>
                  <Slider
                    value={[element.letterSpacing || 0]}
                    onValueChange={([value]) => update({ letterSpacing: value })}
                    min={-5}
                    max={20}
                    step={0.5}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Line Height: {(element.lineHeight || 1).toFixed(1)}
                  </Label>
                  <Slider
                    value={[element.lineHeight || 1]}
                    onValueChange={([value]) => update({ lineHeight: value })}
                    min={0.5}
                    max={3}
                    step={0.1}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Decoration</Label>
                  <Select
                    value={element.textDecoration || 'none'}
                    onValueChange={(value: TextDecoration) => update({ textDecoration: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="underline">Underline</SelectItem>
                      <SelectItem value="line-through">Strikethrough</SelectItem>
                      <SelectItem value="underline line-through">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Text Effects Section */}
              <Separator />
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium hover:text-foreground">
                  Text Effects
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  {/* Shadow Effect */}
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Shadow</Label>
                      <Switch
                        checked={element.textShadow?.enabled || false}
                        onCheckedChange={(checked) => update({
                          textShadow: {
                            enabled: checked,
                            offsetX: element.textShadow?.offsetX ?? 2,
                            offsetY: element.textShadow?.offsetY ?? 2,
                            blur: element.textShadow?.blur ?? 4,
                            color: element.textShadow?.color ?? '#000000'
                          }
                        })}
                      />
                    </div>
                    {element.textShadow?.enabled && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Offset X</Label>
                          <Input
                            type="number"
                            value={element.textShadow?.offsetX ?? 2}
                            onChange={(e) => update({
                              textShadow: {
                                enabled: true,
                                offsetX: Number(e.target.value),
                                offsetY: element.textShadow?.offsetY ?? 2,
                                blur: element.textShadow?.blur ?? 4,
                                color: element.textShadow?.color ?? '#000000'
                              }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Offset Y</Label>
                          <Input
                            type="number"
                            value={element.textShadow?.offsetY ?? 2}
                            onChange={(e) => update({
                              textShadow: {
                                enabled: true,
                                offsetX: element.textShadow?.offsetX ?? 2,
                                offsetY: Number(e.target.value),
                                blur: element.textShadow?.blur ?? 4,
                                color: element.textShadow?.color ?? '#000000'
                              }
                            })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">
                            Blur: {element.textShadow?.blur ?? 4}px
                          </Label>
                          <Slider
                            value={[element.textShadow?.blur ?? 4]}
                            onValueChange={([value]) => update({
                              textShadow: {
                                enabled: true,
                                offsetX: element.textShadow?.offsetX ?? 2,
                                offsetY: element.textShadow?.offsetY ?? 2,
                                blur: value,
                                color: element.textShadow?.color ?? '#000000'
                              }
                            })}
                            min={0}
                            max={20}
                            step={1}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={element.textShadow?.color ?? '#000000'}
                              onChange={(e) => update({
                                textShadow: {
                                  enabled: true,
                                  offsetX: element.textShadow?.offsetX ?? 2,
                                  offsetY: element.textShadow?.offsetY ?? 2,
                                  blur: element.textShadow?.blur ?? 4,
                                  color: e.target.value
                                }
                              })}
                              className="w-8 h-7 p-1 cursor-pointer"
                            />
                            <Input
                              value={element.textShadow?.color ?? '#000000'}
                              onChange={(e) => update({
                                textShadow: {
                                  enabled: true,
                                  offsetX: element.textShadow?.offsetX ?? 2,
                                  offsetY: element.textShadow?.offsetY ?? 2,
                                  blur: element.textShadow?.blur ?? 4,
                                  color: e.target.value
                                }
                              })}
                              className="flex-1 h-7 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Outline Effect */}
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Outline</Label>
                      <Switch
                        checked={element.textOutline?.enabled || false}
                        onCheckedChange={(checked) => update({
                          textOutline: {
                            enabled: checked,
                            width: element.textOutline?.width ?? 1,
                            color: element.textOutline?.color ?? '#000000'
                          }
                        })}
                      />
                    </div>
                    {element.textOutline?.enabled && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">
                            Width: {element.textOutline?.width ?? 1}px
                          </Label>
                          <Slider
                            value={[element.textOutline?.width ?? 1]}
                            onValueChange={([value]) => update({
                              textOutline: {
                                enabled: true,
                                width: value,
                                color: element.textOutline?.color ?? '#000000'
                              }
                            })}
                            min={1}
                            max={10}
                            step={1}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={element.textOutline?.color ?? '#000000'}
                              onChange={(e) => update({
                                textOutline: {
                                  enabled: true,
                                  width: element.textOutline?.width ?? 1,
                                  color: e.target.value
                                }
                              })}
                              className="w-8 h-7 p-1 cursor-pointer"
                            />
                            <Input
                              value={element.textOutline?.color ?? '#000000'}
                              onChange={(e) => update({
                                textOutline: {
                                  enabled: true,
                                  width: element.textOutline?.width ?? 1,
                                  color: e.target.value
                                }
                              })}
                              className="flex-1 h-7 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Glow Effect */}
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Glow</Label>
                      <Switch
                        checked={element.textGlow?.enabled || false}
                        onCheckedChange={(checked) => update({
                          textGlow: {
                            enabled: checked,
                            blur: element.textGlow?.blur ?? 8,
                            color: element.textGlow?.color ?? '#ffffff'
                          }
                        })}
                      />
                    </div>
                    {element.textGlow?.enabled && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">
                            Blur: {element.textGlow?.blur ?? 8}px
                          </Label>
                          <Slider
                            value={[element.textGlow?.blur ?? 8]}
                            onValueChange={([value]) => update({
                              textGlow: {
                                enabled: true,
                                blur: value,
                                color: element.textGlow?.color ?? '#ffffff'
                              }
                            })}
                            min={2}
                            max={30}
                            step={1}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={element.textGlow?.color ?? '#ffffff'}
                              onChange={(e) => update({
                                textGlow: {
                                  enabled: true,
                                  blur: element.textGlow?.blur ?? 8,
                                  color: e.target.value
                                }
                              })}
                              className="w-8 h-7 p-1 cursor-pointer"
                            />
                            <Input
                              value={element.textGlow?.color ?? '#ffffff'}
                              onChange={(e) => update({
                                textGlow: {
                                  enabled: true,
                                  blur: element.textGlow?.blur ?? 8,
                                  color: e.target.value
                                }
                              })}
                              className="flex-1 h-7 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input
                  type="number"
                  value={Math.round(element.x)}
                  onChange={(e) => update({ x: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  value={Math.round(element.y)}
                  onChange={(e) => update({ y: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Size - for shapes that have size */}
          {showSize && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Size</Label>
                <Button
                  variant={aspectRatioLocked ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    if (!aspectRatioLocked && element) {
                      setAspectRatio(element.width / element.height);
                    }
                    setAspectRatioLocked(!aspectRatioLocked);
                  }}
                  title={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                >
                  {aspectRatioLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <Input
                    type="number"
                    value={Math.round(element.width)}
                    onChange={(e) => {
                      const newWidth = Math.max(10, Number(e.target.value));
                      if (aspectRatioLocked) {
                        update({ width: newWidth, height: Math.round(newWidth / aspectRatio) });
                      } else {
                        update({ width: newWidth });
                      }
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    value={Math.round(element.height)}
                    onChange={(e) => {
                      const newHeight = Math.max(10, Number(e.target.value));
                      if (aspectRatioLocked) {
                        update({ width: Math.round(newHeight * aspectRatio), height: newHeight });
                      } else {
                        update({ height: newHeight });
                      }
                    }}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {aspectRatioLocked && (
                <div className="flex items-center justify-center">
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground ml-1">Aspect ratio locked</span>
                </div>
              )}
            </div>
          )}

          {/* Rotation - not for text */}
          {!isTextElement && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Rotation: {element.rotation}°</Label>
              <Slider
                value={[element.rotation]}
                onValueChange={([value]) => update({ rotation: value })}
                min={0}
                max={360}
                step={1}
              />
            </div>
          )}

          {/* Flip/Transform */}
          {!isPin && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Transform</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onFlipHorizontal?.(element.id)}
                >
                  <FlipHorizontal2 className="h-3 w-3 mr-1" />
                  Flip H
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onFlipVertical?.(element.id)}
                >
                  <FlipVertical2 className="h-3 w-3 mr-1" />
                  Flip V
                </Button>
              </div>
            </div>
          )}

          {/* Layer Order Controls */}
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-medium">Layer Order</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const maxZ = elements.length > 0 ? Math.max(...elements.map(el => el.zIndex)) : 0;
                  update({ zIndex: maxZ + 1 });
                }}
              >
                <ArrowUp className="h-3 w-3 mr-1" />
                To Front
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const minZ = elements.length > 0 ? Math.min(...elements.map(el => el.zIndex)) : 0;
                  update({ zIndex: minZ - 1 });
                }}
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                To Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => update({ zIndex: element.zIndex + 1 })}
              >
                <ChevronUp className="h-3 w-3 mr-1" />
                Forward
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => update({ zIndex: element.zIndex - 1 })}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                Backward
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Current layer: {element.zIndex}</p>
          </div>

          {/* Shape-specific: Corner Radius */}
          {showCornerRadius && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">Corner Radius: {element.cornerRadius || 0}px</Label>
                <Slider
                  value={[element.cornerRadius || 0]}
                  onValueChange={([value]) => update({ cornerRadius: value })}
                  min={0}
                  max={Math.min(element.width, element.height) / 2}
                  step={1}
                />
              </div>
            </>
          )}

          {/* Polygon sides */}
          {showPolygonSides && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sides: {element.sides || 6}</Label>
                <Slider
                  value={[element.sides || 6]}
                  onValueChange={([value]) => update({ sides: value })}
                  min={3}
                  max={12}
                  step={1}
                />
              </div>
            </>
          )}

          {/* Fill Color - for shapes */}
          {showFill && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-medium">Fill</Label>

                {/* Gradient Editor */}
                <GradientEditor
                  gradient={element.gradient}
                  fillColor={element.fillColor}
                  onChange={(gradient: Gradient) => update({ gradient })}
                />

                {/* Solid color picker (shown when gradient type is solid) */}
                {(!element.gradient || element.gradient.type === 'solid') && (
                  <ColorPicker
                    label="Color"
                    color={element.fillColor}
                    onChange={(color) => update({ fillColor: color })}
                    onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'fillColor') : undefined}
                  />
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Opacity: {Math.round(element.fillOpacity * 100)}%
                  </Label>
                  <Slider
                    value={[element.fillOpacity * 100]}
                    onValueChange={([value]) => update({ fillOpacity: value / 100 })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </>
          )}

          {/* Stroke - for shapes */}
          {showStroke && (
            <>
              <Separator />
              <div className="space-y-3">
                <ColorPicker
                  label="Stroke"
                  color={element.strokeColor}
                  onChange={(color) => update({ strokeColor: color })}
                  onEyedropperRequest={onActivateEyedropper ? () => onActivateEyedropper(element.id, 'strokeColor') : undefined}
                />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Style</Label>
                  <Select
                    value={element.strokeStyle || 'solid'}
                    onValueChange={(value: StrokeStyle) => update({ strokeStyle: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                      <SelectItem value="dash-dot">Dash-Dot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Width: {element.strokeWidth}px</Label>
                  <Slider
                    value={[element.strokeWidth]}
                    onValueChange={([value]) => update({ strokeWidth: value })}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Opacity: {Math.round(element.strokeOpacity * 100)}%
                  </Label>
                  <Slider
                    value={[element.strokeOpacity * 100]}
                    onValueChange={([value]) => update({ strokeOpacity: value / 100 })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PropertiesPanel;
