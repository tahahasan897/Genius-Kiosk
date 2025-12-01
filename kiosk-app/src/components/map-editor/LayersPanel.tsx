import { Eye, EyeOff, Lock, Unlock, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { MapElement } from './types';
import { useState } from 'react';

interface LayersPanelProps {
  elements: MapElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder: (elements: MapElement[]) => void;
}

const getElementIcon = (type: MapElement['type']) => {
  switch (type) {
    case 'rectangle': return '▢';
    case 'circle': return '○';
    case 'line': return '—';
    case 'arrow': return '→';
    case 'polygon': return '⬡';
    case 'text': return 'T';
    case 'freehand': return '✎';
    case 'triangle': return '△';
    case 'trapezoid': return '⏢';
    case 'parallelogram': return '▱';
    default: return '□';
  }
};

const LayersPanel = ({
  elements,
  selectedId,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder,
}: LayersPanelProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Sort elements by zIndex in reverse (highest first for layer order)
  const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedElement = elements.find(el => el.id === draggedId);
    const targetElement = elements.find(el => el.id === targetId);

    if (!draggedElement || !targetElement) return;

    // Calculate new zIndices
    const newElements = [...elements];
    const draggedIndex = newElements.findIndex(el => el.id === draggedId);
    const targetIndex = newElements.findIndex(el => el.id === targetId);

    // Simple swap of zIndex for now, or re-calculate all zIndices
    // Better approach: re-sort based on drag position

    // Let's just re-order the array based on visual position and then re-assign zIndices
    const visualOrder = [...sortedElements];
    const fromIndex = visualOrder.findIndex(el => el.id === draggedId);
    const toIndex = visualOrder.findIndex(el => el.id === targetId);

    visualOrder.splice(fromIndex, 1);
    visualOrder.splice(toIndex, 0, draggedElement);

    // Re-assign zIndices based on new visual order (reverse)
    const updatedElements = visualOrder.map((el, index) => ({
      ...el,
      zIndex: visualOrder.length - 1 - index
    }));

    // Merge updates back to original array structure if needed, or just replace
    onReorder(updatedElements);
    setDraggedId(null);
  };

  return (
    <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h3 className="font-semibold text-sm truncate">Layers</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedElements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-2 break-words">
              No elements yet. Use the tools to add shapes.
            </p>
          ) : (
            sortedElements.map((element) => (
              <div
                key={element.id}
                draggable
                onDragStart={(e) => handleDragStart(e, element.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, element.id)}
                className={cn(
                  'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors min-w-0',
                  selectedId === element.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted',
                  !element.visible && 'opacity-50',
                  draggedId === element.id && 'opacity-50'
                )}
                onClick={() => onSelect(element.id)}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />

                <span className="w-5 text-center text-sm flex-shrink-0" style={{ color: element.fillColor }}>
                  {getElementIcon(element.type)}
                </span>

                <span className="flex-1 text-sm truncate min-w-0">
                  {(element.showNameOn === 'layers' || element.showNameOn === 'both' || !element.showNameOn)
                    ? (element.name || `${element.type} ${element.id.slice(-4)}`)
                    : `${element.type} ${element.id.slice(-4)}`}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(element.id);
                    }}
                  >
                    {element.visible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(element.id);
                    }}
                  >
                    {element.locked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LayersPanel;

