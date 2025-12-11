import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Trash2, Droplet, RectangleHorizontal, Gauge } from 'lucide-react';
import type { MapElement, AnimationStyle } from './types';
import { animationStyleLabels } from './types';

interface ContextualToolbarProps {
  element: MapElement | null;
  position: { x: number; y: number } | null;
  scale: number;
  stagePosition: { x: number; y: number };
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  onUpdateElement: (id: string, updates: Partial<MapElement>) => void;
  onDeleteElement: (id: string) => void;
}

const ContextualToolbar = ({
  element,
  position,
  scale,
  stagePosition,
  canvasContainerRef,
  onUpdateElement,
  onDeleteElement,
}: ContextualToolbarProps) => {
  if (!element || !position) return null;

  const isTextElement = element.type === 'text';
  const isPin = element.type === 'smart-pin' || element.type === 'static-pin';
  const isLineOrArrow = element.type === 'line' || element.type === 'arrow';
  const isShape = !isTextElement && !isPin;

  // Calculate screen position relative to canvas container
  const screenX = position.x * scale + stagePosition.x;
  const screenY = position.y * scale + stagePosition.y - 73; // 73px above element

  // Ensure toolbar stays within viewport bounds
  const containerRect = canvasContainerRef.current?.getBoundingClientRect();
  const clampedY = Math.max(10, screenY);

  return (
    <div
      className="absolute z-50 flex items-center gap-1 p-1.5 bg-card border border-border rounded-lg shadow-lg"
      style={{
        left: screenX,
        top: clampedY,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Fill Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fill Color">
            <div
              className="w-5 h-5 rounded border border-border"
              style={{ backgroundColor: element.fillColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" side="top">
          <div className="space-y-2">
            <label className="text-xs font-medium">Fill Color</label>
            <Input
              type="color"
              value={element.fillColor}
              onChange={(e) => onUpdateElement(element.id, { fillColor: e.target.value })}
              className="w-24 h-8 cursor-pointer"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Stroke Color - only for shapes */}
      {isShape && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Stroke Color">
              <div
                className="w-5 h-5 rounded border-2"
                style={{ borderColor: element.strokeColor, backgroundColor: 'transparent' }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" side="top">
            <div className="space-y-2">
              <label className="text-xs font-medium">Stroke Color</label>
              <Input
                type="color"
                value={element.strokeColor}
                onChange={(e) => onUpdateElement(element.id, { strokeColor: e.target.value })}
                className="w-24 h-8 cursor-pointer"
              />
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Stroke Width - only for lines and arrows */}
      {isLineOrArrow && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Stroke Width">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="12" x2="20" y2="12" strokeWidth="4" />
              </svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-3" side="top">
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Width: {element.strokeWidth || 2}px
              </label>
              <Slider
                value={[element.strokeWidth || 2]}
                onValueChange={([value]) => onUpdateElement(element.id, { strokeWidth: value })}
                min={1}
                max={20}
                step={1}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Corner Radius - only for shapes that support it */}
      {isShape && element.type !== 'circle' && element.type !== 'line' && element.type !== 'arrow' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Corner Radius">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M 6 18 A 12 12 0 0 1 18 6" strokeLinecap="round" />
              </svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-3" side="top">
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Radius: {element.cornerRadius || 0}px
              </label>
              <Slider
                value={[element.cornerRadius || 0]}
                onValueChange={([value]) => onUpdateElement(element.id, { cornerRadius: value })}
                min={0}
                max={50}
                step={1}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Text-specific: Font Size */}
      {isTextElement && (
        <Select
          value={String(element.fontSize || 24)}
          onValueChange={(v) => onUpdateElement(element.id, { fontSize: Number(v) })}
        >
          <SelectTrigger className="h-8 w-16 text-xs" title="Font Size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 14, 16, 18, 24, 32, 48, 64, 72, 96].map(size => (
              <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Text-specific: Font Weight Toggle */}
      {isTextElement && (
        <Button
          variant={element.fontWeight === 'bold' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 font-bold"
          onClick={() => onUpdateElement(element.id, {
            fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold'
          })}
          title="Bold"
        >
          B
        </Button>
      )}

      {/* Pin-specific: Animation Style */}
      {isPin && (
        <Select
          value={String(element.animationStyle ?? 0)}
          onValueChange={(v) => onUpdateElement(element.id, { animationStyle: Number(v) as AnimationStyle })}
        >
          <SelectTrigger className="h-8 w-28 text-xs" title="Animation Style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(animationStyleLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Pin-specific: Motion Scale (Animation Speed) */}
      {isPin && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Animation Speed">
              <Gauge className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-3" side="top">
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Speed: {(element.motionScale ?? 1).toFixed(1)}x
              </label>
              <Slider
                value={[element.motionScale ?? 1]}
                onValueChange={([value]) => onUpdateElement(element.id, { motionScale: value })}
                min={0.25}
                max={3}
                step={0.25}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => onDeleteElement(element.id)}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ContextualToolbar;
