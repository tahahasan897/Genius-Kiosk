import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Hexagon,
  Type,
  Pencil,
  Triangle,
  Eraser,
  Upload,
  Crop
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Tool, ElementType } from './types';

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUploadClick: () => void;
}

// Custom icons for shapes not in lucide
const TrapezoidIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M4 18 L7 6 L17 6 L20 18 Z" />
  </svg>
);

const ParallelogramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M6 18 L10 6 L20 6 L16 18 Z" />
  </svg>
);

// Smart Pin icon - pin with link indicator
const SmartPinIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Pin shape */}
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    {/* Link icon inside */}
    <circle cx="12" cy="9" r="2.5" fill="currentColor" />
    <path d="M10 9h4" strokeWidth="1.5" />
  </svg>
);

// Static Pin icon - cornered square badge with pointer
const StaticPinIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Rounded rectangle body */}
    <rect x="4" y="3" width="16" height="12" rx="2" ry="2" />
    {/* Triangular pointer at bottom */}
    <path d="M9 15 L12 21 L15 15" fill="currentColor" />
    {/* Info "i" inside */}
    <circle cx="12" cy="7" r="0.5" fill="currentColor" />
    <path d="M12 9v3" strokeWidth="2" />
  </svg>
);

// Device Pin icon - kiosk/screen with stand
const DevicePinIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Screen/monitor */}
    <rect x="3" y="2" width="18" height="12" rx="1" ry="1" />
    {/* Screen inner area */}
    <rect x="5" y="4" width="14" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
    {/* Stand neck */}
    <path d="M12 14 L12 18" />
    {/* Stand base */}
    <path d="M7 18 L17 18" />
    {/* Screen shine */}
    <path d="M6 5 L8 5" strokeWidth="1.5" />
    {/* Pointer at bottom */}
    <path d="M9 18 L12 22 L15 18" fill="currentColor" />
  </svg>
);

const shapeTools: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
  { id: 'trapezoid', icon: TrapezoidIcon, label: 'Trapezoid' },
  { id: 'parallelogram', icon: ParallelogramIcon, label: 'Parallelogram' },
  { id: 'polygon', icon: Hexagon, label: 'Polygon' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
];

const pinTools: { id: Tool; icon: React.ElementType; label: string; description: string; color: string }[] = [
  {
    id: 'smart-pin',
    icon: SmartPinIcon,
    label: 'Smart Pin',
    description: 'Link products to this location',
    color: 'text-red-500'
  },
  {
    id: 'static-pin',
    icon: StaticPinIcon,
    label: 'Static Pin',
    description: 'Add labels (Restroom, Cashier, etc.)',
    color: 'text-green-500'
  },
  {
    id: 'device-pin',
    icon: DevicePinIcon,
    label: 'Device Pin',
    description: 'Mark kiosk or screen locations',
    color: 'text-indigo-500'
  },
];

const Sidebar = ({ activeTool, onToolChange, onUploadClick }: ToolbarProps) => {

  const handleDragStart = (e: React.DragEvent, toolType: Tool) => {
    e.dataTransfer.setData('toolType', toolType);
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full relative z-20 flex-shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold mb-2">Tools</h2>
        <div className="flex gap-2 mb-2">
          <Button
            variant={activeTool === 'select' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onToolChange('select')}
          >
            <MousePointer2 className="h-4 w-4 mr-2" />
            Select
          </Button>
          <Button
            variant={activeTool === 'freehand' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onToolChange('freehand')}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Draw
          </Button>
        </div>
        <Button
          variant={activeTool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={() => onToolChange('eraser')}
        >
          <Eraser className="h-4 w-4 mr-2" />
          Eraser
        </Button>
      </div>

      <Tabs defaultValue="shapes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-center rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="shapes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 text-sm"
          >
            Shapes
          </TabsTrigger>
          <TabsTrigger
            value="pins"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 text-sm"
          >
            Pins
          </TabsTrigger>
          <TabsTrigger
            value="text"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 text-sm"
          >
            Text
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 text-sm"
          >
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shapes" className="flex-1 p-4 m-0 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-2 gap-3">
              {shapeTools.map((tool) => (
                <div
                  key={tool.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tool.id)}
                  onClick={() => onToolChange(tool.id)}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg border cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors
                    ${activeTool === tool.id ? 'border-primary bg-accent' : 'border-border'}
                  `}
                >
                  <tool.icon className="h-8 w-8 mb-2" />
                  <span className="text-xs font-medium">{tool.label}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pins" className="flex-1 p-4 m-0 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-3">
              {pinTools.map((tool) => (
                <div
                  key={tool.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tool.id)}
                  onClick={() => onToolChange(tool.id)}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors
                    ${activeTool === tool.id ? 'border-primary bg-accent' : 'border-border'}
                  `}
                >
                  <div className={`${tool.color} flex-shrink-0`}>
                    <tool.icon className="h-10 w-10" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <span className="font-medium text-sm block">{tool.label}</span>
                    <span className="text-xs text-muted-foreground block leading-tight">{tool.description}</span>
                  </div>
                </div>
              ))}
              
              <Separator className="my-4" />
              
              <div className="text-xs text-muted-foreground space-y-2 p-2 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground mb-2">How to use pins:</p>
                <p className="leading-relaxed break-words whitespace-normal">
                  <span className="text-red-500 font-medium">Smart Pins</span> - Drag to map, then link products via the Links tab.
                </p>
                <p className="leading-relaxed break-words whitespace-normal">
                  <span className="text-green-500 font-medium">Static Pins</span> - Drag to map for fixed labels like "Restroom" or "Exit".
                </p>
                <p className="leading-relaxed break-words whitespace-normal">
                  <span className="text-indigo-500 font-medium">Device Pins</span> - Mark kiosk or screen locations on the map.
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="text" className="flex-1 p-4 m-0">
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, 'text')}
            onClick={() => onToolChange('text')}
            className={`
              flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-border cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors
              ${activeTool === 'text' ? 'border-primary bg-accent' : ''}
            `}
          >
            <Type className="h-12 w-12 mb-2" />
            <span className="font-medium">Add Text</span>
            <span className="text-xs text-muted-foreground mt-1">Drag to canvas</span>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="flex-1 p-4 m-0">
          <div
            onClick={onUploadClick}
            className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-border cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors hover:border-primary"
          >
            <Upload className="h-12 w-12 mb-2" />
            <span className="font-medium">Upload Image</span>
            <span className="text-xs text-muted-foreground mt-1 text-center">Click to upload a floor plan or background image</span>
          </div>

          <div className="mt-4 text-xs text-muted-foreground space-y-2 p-2 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground mb-2">Supported formats:</p>
            <p>PNG, JPG, JPEG, GIF, WebP</p>
            <p>Max file size: 10MB</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sidebar;

