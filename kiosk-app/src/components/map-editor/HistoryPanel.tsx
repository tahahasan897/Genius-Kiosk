import { Clock, Square, Circle, Triangle, Hexagon, Minus, ArrowRight, MapPin, Type, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ElementType, StrokeStyle, Gradient } from './types';

// History entry - stores all element properties for quick reuse
export interface ElementHistoryEntry {
  id: string;
  type: ElementType;
  // Size
  width: number;
  height: number;
  // Fill
  fillColor: string;
  fillOpacity: number;
  // Stroke
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeStyle?: StrokeStyle;
  // Transform
  rotation: number;
  cornerRadius?: number;
  // Polygon specific
  sides?: number;
  // Gradient
  gradient?: Gradient;
  // Pin-specific properties
  animationStyle?: number;
  motionScale?: number;
  pinLabel?: string;
  pinLabelFontSize?: number;
  pinLabelColor?: string;
  pinLabelFontWeight?: 'normal' | 'bold';
  pinLabelFontFamily?: string;
  // Text-specific properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  // Timestamp
  timestamp: number;
}

interface HistoryPanelProps {
  history: ElementHistoryEntry[];
  onPlaceElement: (entry: ElementHistoryEntry) => void;
  onClearHistory?: () => void;
}

// Custom icons for shapes not in lucide
const TrapezoidIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 18 L7 6 L17 6 L20 18 Z" />
  </svg>
);

const ParallelogramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 18 L10 6 L20 6 L16 18 Z" />
  </svg>
);

const getElementIcon = (type: ElementType) => {
  switch (type) {
    case 'rectangle': return Square;
    case 'circle': return Circle;
    case 'triangle': return Triangle;
    case 'polygon': return Hexagon;
    case 'trapezoid': return TrapezoidIcon;
    case 'parallelogram': return ParallelogramIcon;
    case 'line': return Minus;
    case 'arrow': return ArrowRight;
    case 'smart-pin': return MapPin;
    case 'static-pin': return MapPin;
    case 'device-pin': return Monitor;
    case 'text': return Type;
    default: return Square;
  }
};

const getElementLabel = (type: ElementType) => {
  switch (type) {
    case 'rectangle': return 'Rectangle';
    case 'circle': return 'Circle';
    case 'triangle': return 'Triangle';
    case 'polygon': return 'Polygon';
    case 'trapezoid': return 'Trapezoid';
    case 'parallelogram': return 'Parallelogram';
    case 'line': return 'Line';
    case 'arrow': return 'Arrow';
    case 'smart-pin': return 'Smart Pin';
    case 'static-pin': return 'Static Pin';
    case 'device-pin': return 'Device Pin';
    case 'text': return 'Text';
    default: return type;
  }
};

const HistoryPanel = ({
  history,
  onPlaceElement,
  onClearHistory,
}: HistoryPanelProps) => {
  return (
    <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Recent Elements</h3>
        </div>
        {history.length > 0 && onClearHistory && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearHistory}
          >
            Clear
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No recent elements yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Place shapes on the canvas and they'll appear here for quick reuse.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-2">
                Click to place again
              </p>
              {history.map((entry) => {
                const Icon = getElementIcon(entry.type);
                const hasStroke = entry.strokeWidth > 0 && entry.strokeOpacity > 0;
                const hasRotation = entry.rotation !== 0;
                const hasCornerRadius = entry.cornerRadius && entry.cornerRadius > 0;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'group flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer',
                      'hover:bg-accent hover:border-primary/30 transition-colors'
                    )}
                    onClick={() => onPlaceElement(entry)}
                  >
                    {/* Color preview with shape icon */}
                    <div
                      className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${entry.fillColor}${Math.round(entry.fillOpacity * 255).toString(16).padStart(2, '0')}`,
                        border: hasStroke ? `${Math.min(entry.strokeWidth, 3)}px solid ${entry.strokeColor}` : '1px solid var(--border)',
                      }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: entry.strokeColor || entry.fillColor }}
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getElementLabel(entry.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(entry.width)} × {Math.round(entry.height)} px
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {hasStroke && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                            {entry.strokeWidth}px stroke
                          </span>
                        )}
                        {hasRotation && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                            {Math.round(entry.rotation)}°
                          </span>
                        )}
                        {hasCornerRadius && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                            r{entry.cornerRadius}
                          </span>
                        )}
                        {entry.fillOpacity < 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                            {Math.round(entry.fillOpacity * 100)}% fill
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Color dots - fill and stroke */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: entry.fillColor }}
                        title={`Fill: ${entry.fillColor}`}
                      />
                      {hasStroke && (
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: entry.strokeColor }}
                          title={`Stroke: ${entry.strokeColor}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      {history.length > 0 && (
        <div className="p-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            Showing last {history.length} element{history.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
