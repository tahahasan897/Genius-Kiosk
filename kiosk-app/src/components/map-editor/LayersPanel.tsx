import { Eye, EyeOff, Lock, Unlock, GripVertical, Trash2, Search, X, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { MapElement } from './types';
import { useState, useRef, useEffect, useMemo } from 'react';

interface LayersPanelProps {
  elements: MapElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder: (elements: MapElement[]) => void;
  onNameElement?: (id: string, name: string) => void;
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
    case 'smart-pin': return '📍';
    case 'static-pin': return '📌';
    case 'device-pin': return '📱';
    case 'group': return '📁';
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
  onNameElement,
}: LayersPanelProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sort elements by zIndex in reverse (highest first for layer order)
  const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  // Filter elements based on search query
  const filteredElements = useMemo(() => {
    if (!searchQuery.trim()) return sortedElements;

    const query = searchQuery.toLowerCase();
    return sortedElements.filter(el => {
      const name = el.name || `${el.type} ${el.id.slice(-4)}`;
      return name.toLowerCase().includes(query) ||
             el.type.toLowerCase().includes(query);
    });
  }, [sortedElements, searchQuery]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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

  // Start inline editing
  const startEditing = (element: MapElement) => {
    const displayName = (element.showNameOn === 'layers' || element.showNameOn === 'both' || !element.showNameOn)
      ? (element.name || `${element.type} ${element.id.slice(-4)}`)
      : `${element.type} ${element.id.slice(-4)}`;
    setEditingId(element.id);
    setEditingValue(element.name || '');
  };

  // Save inline editing
  const saveEditing = () => {
    if (editingId && onNameElement) {
      onNameElement(editingId, editingValue.trim());
    }
    setEditingId(null);
    setEditingValue('');
  };

  // Cancel inline editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue('');
  };

  // Handle key events in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  return (
    <div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
        <h3 className="font-semibold text-sm truncate">Layers</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search layers..."
            className="h-8 pl-7 pr-7 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-[10px] text-muted-foreground">
            {filteredElements.length} of {sortedElements.length} layers
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredElements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-2 break-words">
              {searchQuery ? 'No matching layers found.' : 'No elements yet. Use the tools to add shapes.'}
            </p>
          ) : (
            filteredElements.map((element) => (
              <div
                key={element.id}
                draggable={editingId !== element.id}
                onDragStart={(e) => handleDragStart(e, element.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, element.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (editingId !== element.id) {
                    startEditing(element);
                  }
                }}
                className={cn(
                  'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors min-w-0',
                  selectedId === element.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted',
                  !element.visible && 'opacity-50',
                  draggedId === element.id && 'opacity-50'
                )}
                onClick={() => {
                  if (editingId !== element.id) {
                    onSelect(element.id);
                  }
                }}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />

                <span className="w-5 text-center text-sm flex-shrink-0" style={{ color: element.fillColor }}>
                  {getElementIcon(element.type)}
                </span>

                {editingId === element.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={saveEditing}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-sm min-w-0 bg-background border border-input rounded px-1 py-0.5 outline-none focus:border-primary"
                    placeholder="Enter name..."
                  />
                ) : (
                  <span className="flex-1 text-sm truncate min-w-0">
                    {(element.showNameOn === 'layers' || element.showNameOn === 'both' || !element.showNameOn)
                      ? (element.name || `${element.type} ${element.id.slice(-4)}`)
                      : `${element.type} ${element.id.slice(-4)}`}
                  </span>
                )}

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
