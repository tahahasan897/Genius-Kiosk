import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { MapElement, NameVisibility } from './types';

interface PropertiesPanelProps {
  element: MapElement | null;
  onUpdateElement: (id: string, updates: Partial<MapElement>) => void;
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
const fillElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram'];
// Elements that support corner radius
const cornerRadiusElements = ['rectangle', 'trapezoid', 'parallelogram', 'text'];
// Elements that are line-based (no fill)
const lineElements = ['line', 'arrow', 'freehand'];
// Elements that need size controls
const sizeElements = ['rectangle', 'circle', 'polygon', 'triangle', 'trapezoid', 'parallelogram', 'text'];

const PropertiesPanel = ({ element, onUpdateElement }: PropertiesPanelProps) => {
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
  const showFill = fillElements.includes(element.type);
  const showCornerRadius = cornerRadiusElements.includes(element.type);
  const showSize = sizeElements.includes(element.type);
  const showPolygonSides = element.type === 'polygon';
  const showStroke = !isTextElement; // All shapes except text have stroke

  return (
    <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h3 className="font-semibold text-sm truncate">Properties</h3>
        <p className="text-xs text-muted-foreground capitalize truncate">{element.type}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Name Section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Name</Label>
            <Input
              value={element.name}
              onChange={(e) => update({ name: e.target.value })}
              className="h-8 text-sm"
              placeholder="Element name"
            />
          </div>

          {/* Name Visibility - Only for non-text elements */}
          {!isTextElement && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Show Name</Label>
              <Select
                value={element.showNameOn || 'both'}
                onValueChange={(value: NameVisibility) => update({ showNameOn: value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Layers & Canvas</SelectItem>
                  <SelectItem value="layers">Layers Only</SelectItem>
                  <SelectItem value="canvas">Canvas Only</SelectItem>
                  <SelectItem value="none">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Label Position - Only when name is shown on canvas */}
          {!isTextElement && (element.showNameOn === 'canvas' || element.showNameOn === 'both' || !element.showNameOn) && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Label Position</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Offset X</Label>
                  <Input
                    type="number"
                    value={element.labelOffsetX ?? 0}
                    onChange={(e) => update({ labelOffsetX: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Offset Y</Label>
                  <Input
                    type="number"
                    value={element.labelOffsetY ?? -25}
                    onChange={(e) => update({ labelOffsetY: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Drag label on canvas or adjust here</p>
            </div>
          )}

          <Separator />

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
