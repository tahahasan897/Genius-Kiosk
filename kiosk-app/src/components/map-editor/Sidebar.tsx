import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Hexagon,
  Type,
  Pencil,
  Trash2,
  Triangle,
  Shapes,
  Hand
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
  onDeleteSelected: () => void;
  hasSelection: boolean;
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

const Sidebar = ({ activeTool, onToolChange, onDeleteSelected, hasSelection }: ToolbarProps) => {

  const handleDragStart = (e: React.DragEvent, toolType: Tool) => {
    e.dataTransfer.setData('toolType', toolType);
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold mb-2">Tools</h2>
        <div className="flex gap-2">
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
      </div>

      <Tabs defaultValue="shapes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="shapes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Shapes
          </TabsTrigger>
          <TabsTrigger
            value="text"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Text
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
      </Tabs>

      <div className="p-4 border-t border-border">
        <Button
          variant="destructive"
          className="w-full"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;

