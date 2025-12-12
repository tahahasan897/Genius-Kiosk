import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown, Eraser, Undo2 } from 'lucide-react';
import type { MapElement, AnimationStyle, Tool } from './types';
import { animationStyleLabels } from './types';

interface PropertiesPanelProps {
  element: MapElement | null;
  elements: MapElement[]; // Full list for z-index calculations
  onUpdateElement: (id: string, updates: Partial<MapElement>) => void;
  // Eraser props
  activeTool?: Tool;
  eraserSize?: number;
  onEraserSizeChange?: (size: number) => void;
  onClearEraserStrokes?: () => void;
  hasEraserStrokes?: boolean;
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
const fillElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram', 'smart-pin', 'static-pin'];
// Elements that support corner radius
const cornerRadiusElements = ['rectangle', 'trapezoid', 'parallelogram', 'text'];
// Elements that are line-based (no fill)
const lineElements = ['line', 'arrow', 'freehand'];
// Elements that need size controls
const sizeElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram', 'text'];
// Pin elements
const pinElements = ['smart-pin', 'static-pin'];

const PropertiesPanel = ({
  element,
  elements,
  onUpdateElement,
  activeTool,
  eraserSize = 20,
  onEraserSizeChange,
  onClearEraserStrokes,
  hasEraserStrokes = false,
}: PropertiesPanelProps) => {
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

  const isTextElement = element.type === 'text';
  const isPin = pinElements.includes(element.type);
  const isSmartPin = element.type === 'smart-pin';
  const isStaticPin = element.type === 'static-pin';
  const showFill = fillElements.includes(element.type);
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
                {/* Pin Label - only for static pins */}
                {isStaticPin && (
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Label Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={element.pinLabelColor || '#ffffff'}
                          onChange={(e) => update({ pinLabelColor: e.target.value })}
                          className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                        />
                        <Input
                          value={element.pinLabelColor || '#ffffff'}
                          onChange={(e) => update({ pinLabelColor: e.target.value })}
                          className="flex-1 h-8 text-sm font-mono min-w-0"
                        />
                      </div>
                    </div>
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

                {/* Pin Color */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Pin Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={element.fillColor}
                      onChange={(e) => update({ fillColor: e.target.value })}
                      className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={element.fillColor}
                      onChange={(e) => update({ fillColor: e.target.value })}
                      className="flex-1 h-8 text-sm font-mono min-w-0"
                    />
                  </div>
                </div>

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

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={element.labelColor || '#000000'}
                      onChange={(e) => update({ labelColor: e.target.value })}
                      className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={element.labelColor || '#000000'}
                      onChange={(e) => update({ labelColor: e.target.value })}
                      className="flex-1 h-8 text-sm font-mono min-w-0"
                    />
                  </div>
                </div>
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

              <div className="space-y-2">
                <Label className="text-xs font-medium">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={element.fillColor}
                    onChange={(e) => update({ fillColor: e.target.value })}
                    className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                  />
                  <Input
                    value={element.fillColor}
                    onChange={(e) => update({ fillColor: e.target.value })}
                    className="flex-1 h-8 text-sm font-mono min-w-0"
                  />
                </div>
              </div>

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
              <Label className="text-xs font-medium">Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <Input
                    type="number"
                    value={Math.round(element.width)}
                    onChange={(e) => update({ width: Math.max(10, Number(e.target.value)) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    value={Math.round(element.height)}
                    onChange={(e) => update({ height: Math.max(10, Number(e.target.value)) })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
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
              <div className="space-y-2">
                <Label className="text-xs font-medium">Fill Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={element.fillColor}
                    onChange={(e) => update({ fillColor: e.target.value })}
                    className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                  />
                  <Input
                    value={element.fillColor}
                    onChange={(e) => update({ fillColor: e.target.value })}
                    className="flex-1 h-8 text-sm font-mono min-w-0"
                  />
                </div>
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
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Stroke</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={element.strokeColor}
                      onChange={(e) => update({ strokeColor: e.target.value })}
                      className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={element.strokeColor}
                      onChange={(e) => update({ strokeColor: e.target.value })}
                      className="flex-1 h-8 text-sm font-mono min-w-0"
                    />
                  </div>
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
