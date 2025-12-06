import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Trash2, Hammer, ArrowLeft, ZoomIn, ZoomOut, Maximize, Grid, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text as KonvaText, RegularPolygon, Transformer, Image as KonvaImage, Group } from 'react-konva';
import useImage from 'use-image';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Sidebar from './map-editor/Sidebar';
import LayersPanel from './map-editor/LayersPanel';
import PropertiesPanel from './map-editor/PropertiesPanel';
import LinksPanel from './map-editor/LinksPanel';
import type { MapElement, Tool, ElementType } from './map-editor/types';
import { defaultElement, defaultSizes, defaultSmartPin, defaultStaticPin, CANVAS_WIDTH, CANVAS_HEIGHT } from './map-editor/types';

interface MapEditorProps {
    storeId: number;
    onSave?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MapEditor = ({ storeId, onSave }: MapEditorProps) => {
    const [mode, setMode] = useState<'choice' | 'builder'>('choice');
    const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
    const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
    const [elements, setElements] = useState<MapElement[]>([]);
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [tool, setTool] = useState<Tool>('select');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [freehandPoints, setFreehandPoints] = useState<number[]>([]);
    const [showGrid, setShowGrid] = useState(true);
    const [copiedElements, setCopiedElements] = useState<MapElement[]>([]);
    const [pasteCount, setPasteCount] = useState(0);
    const [isRightMouseDown, setIsRightMouseDown] = useState(false);

    // Selection box state for multi-select
    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        active: boolean;
    } | null>(null);

    // History state for undo/redo
    const [history, setHistory] = useState<MapElement[][]>([[]]);
    const [historyStep, setHistoryStep] = useState(0);

    // Zoom state
    const [scale, setScale] = useState(1);
    const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

    // Inline naming state (replaces dialog)
    const [namingElementId, setNamingElementId] = useState<string | null>(null);
    const [namingValue, setNamingValue] = useState('');
    const [namingPosition, setNamingPosition] = useState({ x: 0, y: 0 });

    // Text editing state
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState('');

    const transformerRef = useRef<any>(null);
    const stageRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const elementsRef = useRef(elements);
    const selectedElementIdsRef = useRef(selectedElementIds);
    const namingInputRef = useRef<HTMLInputElement>(null);
    const textEditInputRef = useRef<HTMLTextAreaElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isUndoRedoRef = useRef(false); // Track if we're in undo/redo
    const isShiftPressedRef = useRef(false); // Track Shift key for proportional resizing
    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map()); // Track drag start positions

    // Keep refs in sync with state
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        selectedElementIdsRef.current = selectedElementIds;
    }, [selectedElementIds]);

    // Load map image
    const [loadedImage] = useImage(mapImageUrl ? `${API_URL}${mapImageUrl}` : '');

    useEffect(() => {
        loadMapData();
    }, [storeId]);

    useEffect(() => {
        if (loadedImage) {
            setMapImage(loadedImage);
        }
    }, [loadedImage]);

    // Load canvas state from localStorage when component mounts or storeId changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`map-editor-canvas-state-${storeId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.showGrid !== undefined) setShowGrid(parsed.showGrid);
                if (parsed.scale !== undefined) setScale(parsed.scale);
                if (parsed.stagePosition) setStagePosition(parsed.stagePosition);
            }
        } catch (error) {
            console.error('Error loading canvas state:', error);
        }
    }, [storeId]);

    // Save canvas state to localStorage whenever it changes
    useEffect(() => {
        try {
            const canvasState = {
                showGrid,
                scale,
                stagePosition,
            };
            localStorage.setItem(`map-editor-canvas-state-${storeId}`, JSON.stringify(canvasState));
        } catch (error) {
            console.error('Error saving canvas state:', error);
        }
    }, [showGrid, scale, stagePosition, storeId]);

    // Focus naming input when it appears
    useEffect(() => {
        if (namingElementId && namingInputRef.current) {
            setTimeout(() => {
                namingInputRef.current?.focus();
                namingInputRef.current?.select();
            }, 50);
        }
    }, [namingElementId]);

    // Focus text edit input when it appears
    useEffect(() => {
        if (editingTextId && textEditInputRef.current) {
            setTimeout(() => {
                textEditInputRef.current?.focus();
                textEditInputRef.current?.select();
            }, 50);
        }
    }, [editingTextId]);

    // Track Shift key for proportional resizing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Immediate save function - returns true on success, false on failure
    const saveElements = useCallback(async (elementsToSave: MapElement[], showFeedback = false): Promise<boolean> => {
        if (elementsToSave.length === 0) {
            if (showFeedback) {
                toast.error('No elements to save');
            }
            return false;
        }

        try {
            console.log(`[SAVE] Starting save for ${elementsToSave.length} elements...`);
            const convertedElements = elementsToSave.map(el => ({
                ...el,
                x: (el.x / CANVAS_WIDTH) * 100,
                y: (el.y / CANVAS_HEIGHT) * 100,
                width: (el.width / CANVAS_WIDTH) * 100,
                height: (el.height / CANVAS_HEIGHT) * 100,
            }));

            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/elements`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ elements: convertedElements })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                const errorMessage = errorData.error || `Save failed with status ${response.status}`;
                console.error('[SAVE] Failed:', errorMessage, response.status);
                if (showFeedback) {
                    toast.error(`Failed to save: ${errorMessage}`);
                }
                return false;
            }

            const result = await response.json();
            console.log('[SAVE] Success!', result);
            if (showFeedback) {
                toast.success(`Map saved successfully! (${result.count || elementsToSave.length} elements)`);
            }
            return true;
        } catch (error: any) {
            console.error('[SAVE] Error:', error);
            if (showFeedback) {
                toast.error(`Save failed: ${error.message || 'Network error'}`);
            }
            return false;
        }
    }, [storeId]);

    // Manual save handler with loading state and feedback
    const handleManualSave = useCallback(async () => {
        if (saving) return; // Prevent multiple simultaneous saves
        
        // Cancel any pending auto-save
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = null;
        }

        // Store currently selected element frontend IDs to restore selection after reload
        const selectedFrontendIds = selectedElementIds.slice();

        setSaving(true);
        try {
            // Clear transformer nodes before reload to prevent stale node references
            if (transformerRef.current) {
                transformerRef.current.nodes([]);
            }

            const success = await saveElements(elements, true);
            if (success) {
                // Clear selection temporarily to prevent transformer from trying to use old nodes
                setSelectedElementIds([]);
                selectedElementIdsRef.current = [];
                
                // Save successful - reload map data to get updated database IDs
                // This ensures frontend element IDs match backend IDs after save
                await loadMapData();

                // Restore selection by matching frontend IDs
                // Wait for React to re-render the Konva stage with new elements before restoring selection
                setTimeout(() => {
                    const currentElements = elementsRef.current;
                    const matchingIds: string[] = [];
                    
                    selectedFrontendIds.forEach(frontendId => {
                        // Try to find element by current ID (might be the same if already database ID)
                        const byCurrentId = currentElements.find(el => el.id === frontendId);
                        if (byCurrentId) {
                            matchingIds.push(byCurrentId.id);
                            return;
                        }
                        
                        // Try to find by frontendId stored in metadata
                        const byMetadata = currentElements.find(el => {
                            const metadata = el.metadata || {};
                            return metadata.frontendId === frontendId || 
                                   metadata.frontendId?.toString() === frontendId;
                        });
                        if (byMetadata) {
                            matchingIds.push(byMetadata.id);
                        }
                    });
                    
                    if (matchingIds.length > 0) {
                        setSelectedElementIds(matchingIds);
                        selectedElementIdsRef.current = matchingIds;
                    }
                }, 300); // Increased timeout to ensure stage is fully re-rendered
            }
        } finally {
            setSaving(false);
        }
    }, [elements, saving, saveElements, selectedElementIds]);

    // Auto-save with debounce
    const autoSave = useCallback(async () => {
        // Don't auto-save if manual save is in progress
        if (saving) {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
                autoSaveTimeoutRef.current = null;
            }
            return;
        }

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(async () => {
            // Double-check saving state before actually saving
            if (!saving) {
                await saveElements(elementsRef.current, false); // Silent auto-save
            }
        }, 1000);
    }, [saveElements, saving]);

    // Save on window close/navigation
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (elementsRef.current.length > 0) {
                const convertedElements = elementsRef.current.map(el => ({
                    ...el,
                    x: (el.x / CANVAS_WIDTH) * 100,
                    y: (el.y / CANVAS_HEIGHT) * 100,
                    width: (el.width / CANVAS_WIDTH) * 100,
                    height: (el.height / CANVAS_HEIGHT) * 100,
                }));

                navigator.sendBeacon(
                    `${API_URL}/api/admin/stores/${storeId}/map/elements`,
                    JSON.stringify({ elements: convertedElements })
                );
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (elementsRef.current.length > 0) {
                saveElements(elementsRef.current);
            }
        };
    }, [storeId, saveElements]);

    // Trigger auto-save when elements change (but not during manual save)
    useEffect(() => {
        if (mode === 'builder' && elements.length > 0 && !saving) {
            autoSave();
        }
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [elements, mode, autoSave, saving]);

    // Update transformer
    useEffect(() => {
        if (!transformerRef.current) return;

        // Clear transformer if no selection or during editing
        if (selectedElementIds.length === 0 || namingElementId || editingTextId) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer().batchDraw();
            return;
        }

        const stage = transformerRef.current.getStage();
        if (!stage) return;

        // Get all selected nodes that aren't lines or arrows (they use custom anchors)
        const selectedNodes = selectedElementIds
            .map(id => {
                const element = elements.find(el => el.id === id);
                // Exclude line and arrow elements (they use custom anchors)
                if (element && (element.type === 'line' || element.type === 'arrow')) {
                    return null;
                }
                // Try to find the node on the stage
                const node = stage.findOne(`#${id}`);
                // Only return node if it exists and is valid
                return node && node.getStage() === stage ? node : null;
            })
            .filter(node => node !== null && node !== undefined);

        // Only set nodes if we have valid nodes
        if (selectedNodes.length > 0) {
            try {
                transformerRef.current.nodes(selectedNodes);
                transformerRef.current.getLayer().batchDraw();
            } catch (error) {
                // If there's an error (e.g., node was removed), clear transformer
                console.warn('Transformer error, clearing nodes:', error);
                transformerRef.current.nodes([]);
                transformerRef.current.getLayer().batchDraw();
            }
        } else {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer().batchDraw();
        }
    }, [selectedElementIds, namingElementId, editingTextId, elements]);

    // Track changes to elements for undo/redo
    useEffect(() => {
        // Skip if we're in the middle of undo/redo
        if (isUndoRedoRef.current) {
            isUndoRedoRef.current = false; // Reset the flag
            return;
        }

        // Only save to history if there are meaningful changes
        if (elements.length >= 0) {
            const currentState = JSON.stringify(elements);
            const lastHistoryState = history[historyStep] ? JSON.stringify(history[historyStep]) : '';

            if (currentState !== lastHistoryState) {
                saveToHistory(elements);
            }
        }
    }, [elements]);

    // Zoom handlers
    const handleZoomIn = useCallback(() => {
        setScale(prev => Math.min(prev * 1.2, 3));
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale(prev => Math.max(prev / 1.2, 0.25));
    }, []);

    const handleResetZoom = useCallback(() => {
        setScale(1);
        setStagePosition({ x: 0, y: 0 });
        // State will be saved automatically via the useEffect that watches scale and stagePosition
    }, []);

    // Mouse wheel zoom
    const handleWheel = (e: any) => {
        e.evt.preventDefault();

        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = scale;
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stagePosition.x) / oldScale,
            y: (pointer.y - stagePosition.y) / oldScale,
        };

        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;
        const clampedScale = Math.max(0.25, Math.min(3, newScale));

        setScale(clampedScale);
        setStagePosition({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        });
    };

    const loadMapData = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map`);
            if (!response.ok) {
                setMapImageUrl(null);
                setMapImage(null);
                setElements([]);
                setMode('choice');
                return;
            }
            const data = await response.json();
            if (data.store?.map_image_url) {
                setMapImageUrl(data.store.map_image_url);
                setMode('builder');
            } else {
                setMapImageUrl(null);
                setMapImage(null);
                setMode('choice');
            }
            if (data.elements && data.elements.length > 0) {
                setElements(data.elements.map((el: any) => {
                    // Parse metadata first - it contains all the element properties
                    const metadata = typeof el.metadata === 'string' ? JSON.parse(el.metadata) : (el.metadata || {});

                    // Merge metadata properties with top-level properties (metadata takes precedence)
                    // This ensures all properties are preserved correctly
                    return {
                        id: el.id.toString(),
                        type: (el.element_type === 'department' || el.element_type === 'aisle') ? 'rectangle' : (metadata.type || el.element_type || 'rectangle'),
                        name: metadata.name ?? el.name ?? '',
                        x: (el.x / 100) * CANVAS_WIDTH,
                        y: (el.y / 100) * CANVAS_HEIGHT,
                        width: (el.width / 100) * CANVAS_WIDTH,
                        height: (el.height / 100) * CANVAS_HEIGHT,
                        rotation: metadata.rotation ?? el.rotation ?? 0,
                        fillColor: metadata.fillColor ?? el.fillColor ?? el.color ?? '#3b82f6',
                        fillOpacity: metadata.fillOpacity ?? el.fillOpacity ?? 0.5,
                        strokeColor: metadata.strokeColor ?? el.strokeColor ?? el.color ?? '#1d4ed8',
                        strokeWidth: metadata.strokeWidth ?? el.strokeWidth ?? 2,
                        strokeOpacity: metadata.strokeOpacity ?? el.strokeOpacity ?? 1,
                        visible: metadata.visible ?? el.visible ?? true,
                        locked: metadata.locked ?? el.locked ?? false,
                        zIndex: metadata.zIndex ?? el.zIndex ?? 0,
                        cornerRadius: metadata.cornerRadius ?? el.cornerRadius ?? 0,
                        text: metadata.text ?? el.text,
                        fontSize: metadata.fontSize ?? el.fontSize ?? 24,
                        fontFamily: metadata.fontFamily ?? el.fontFamily ?? 'Arial',
                        fontWeight: metadata.fontWeight ?? el.fontWeight ?? 'normal',
                        textAlign: metadata.textAlign ?? el.textAlign ?? 'center',
                        points: metadata.points ?? el.points,
                        freehandPoints: metadata.freehandPoints ?? el.freehandPoints,
                        sides: metadata.sides ?? el.sides ?? 6,
                        // Preserve showNameOn from metadata if it exists, otherwise use saved value or default
                        // Check metadata first, then top-level, then fallback to what was originally saved
                        showNameOn: metadata.showNameOn !== undefined ? metadata.showNameOn : (el.showNameOn !== undefined ? el.showNameOn : 'layers'),
                        labelOffsetX: metadata.labelOffsetX ?? el.labelOffsetX ?? 0,
                        labelOffsetY: metadata.labelOffsetY ?? el.labelOffsetY ?? -25,
                        metadata: metadata
                    };
                }));
            } else {
                setElements([]);
            }
        } catch (error) {
            console.error('Error loading map:', error);
            setMapImageUrl(null);
            setMapImage(null);
            setElements([]);
            setMode('choice');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image size must be less than 10MB');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/image`,
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to upload image');
            }

            const data = await response.json();
            setMapImageUrl(data.imageUrl);
            setMode('builder');
            toast.success('Map image uploaded successfully');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Get element center position for inline naming
    const getElementCenter = (element: MapElement): { x: number; y: number } => {
        const container = canvasContainerRef.current;
        if (!container) return { x: 0, y: 0 };

        const rect = container.getBoundingClientRect();
        let centerX: number, centerY: number;

        if (element.type === 'circle' || element.type === 'polygon' || element.type === 'triangle') {
            centerX = element.x;
            centerY = element.y;
        } else {
            centerX = element.x + element.width / 2;
            centerY = element.y + element.height / 2;
        }

        // Apply zoom and position
        const screenX = centerX * scale + stagePosition.x + container.scrollLeft;
        const screenY = centerY * scale + stagePosition.y + container.scrollTop;

        return { x: screenX, y: screenY };
    };

    const createElement = (type: ElementType, x: number, y: number) => {
        const id = Date.now().toString();
        const size = defaultSizes[type] || { width: 100, height: 100 };
        const elementName = getDefaultName(type);

        let newElement: MapElement | null = null;

        switch (type) {
            case 'rectangle':
                newElement = {
                    id,
                    type: 'rectangle',
                    name: elementName,
                    x,
                    y,
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'circle':
                newElement = {
                    id,
                    type: 'circle',
                    name: elementName,
                    x, // Center X
                    y, // Center Y
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'triangle':
                newElement = {
                    id,
                    type: 'triangle',
                    name: elementName,
                    x,
                    y,
                    width: size.width,
                    height: size.height,
                    sides: 3,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'trapezoid':
                newElement = {
                    id,
                    type: 'trapezoid',
                    name: elementName,
                    x,
                    y,
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'parallelogram':
                newElement = {
                    id,
                    type: 'parallelogram',
                    name: elementName,
                    x,
                    y,
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'line':
                newElement = {
                    id,
                    type: 'line',
                    name: elementName,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    points: [x - 50, y, x + 50, y],
                    ...defaultElement,
                } as MapElement;
                break;
            case 'arrow':
                newElement = {
                    id,
                    type: 'arrow',
                    name: elementName,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    points: [x - 50, y, x + 50, y],
                    ...defaultElement,
                } as MapElement;
                break;
            case 'polygon':
                newElement = {
                    id,
                    type: 'polygon',
                    name: elementName,
                    x,
                    y,
                    width: size.width,
                    height: size.height,
                    sides: 6,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'text':
                newElement = {
                    id,
                    type: 'text',
                    name: elementName,
                    x: x - 100,
                    y: y - 20,
                    width: 200,
                    height: 40,
                    text: 'Double-click to edit',
                    ...defaultElement,
                } as MapElement;
                break;
            case 'smart-pin':
                newElement = {
                    id,
                    type: 'smart-pin',
                    name: elementName,
                    x: x, // Anchor point (bottom of pin V)
                    y: y, // Anchor point (bottom of pin V)
                    width: size.width,
                    height: size.height,
                    ...defaultSmartPin,
                } as MapElement;
                break;
            case 'static-pin':
                newElement = {
                    id,
                    type: 'static-pin',
                    name: elementName,
                    x: x, // Anchor point (bottom of pin V)
                    y: y, // Anchor point (bottom of pin V)
                    width: size.width,
                    height: size.height,
                    ...defaultStaticPin,
                } as MapElement;
                break;
        }

        if (newElement) {
            newElement.zIndex = elements.length;
            // Default to showing name only in layers for shapes, so they are clean on canvas
            if (newElement.type !== 'text') {
                newElement.showNameOn = 'layers';
            }

            setElements(prev => [...prev, newElement!]);
            setSelectedElementIds([newElement.id]);

            // Auto-start editing ONLY for text elements
            if (newElement.type === 'text') {
                const center = getElementCenter(newElement);
                setNamingPosition(center);
                setEditingTextValue(newElement.text || '');
                setEditingTextId(newElement.id);
            }

            // Auto-switch to select mode
            setTool('select');

            // For smart-pin and static-pin, trigger immediate save and reload
            // to ensure they get database IDs for product linking
            if (newElement.type === 'smart-pin' || newElement.type === 'static-pin') {
                const pinId = newElement.id;
                // Cancel pending auto-save to avoid conflicts
                if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                    autoSaveTimeoutRef.current = null;
                }
                // Use timeout to ensure state is updated first, then save and reload
                setTimeout(async () => {
                    const success = await saveElements(elementsRef.current, false);
                    if (success) {
                        await loadMapData();
                        // Restore selection to the new pin by finding it via frontendId in metadata
                        setTimeout(() => {
                            const currentElements = elementsRef.current;
                            const savedPin = currentElements.find(el => {
                                const metadata = el.metadata || {};
                                return metadata.frontendId === pinId || metadata.frontendId?.toString() === pinId;
                            });
                            if (savedPin) {
                                setSelectedElementIds([savedPin.id]);
                            }
                        }, 100);
                    }
                }, 50);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const toolType = e.dataTransfer.getData('toolType') as ElementType;
        if (!toolType) return;

        const stage = stageRef.current;
        if (!stage) return;

        stage.setPointersPositions(e);
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const adjustedPos = {
            x: (pos.x - stagePosition.x) / scale,
            y: (pos.y - stagePosition.y) / scale,
        };

        createElement(toolType, adjustedPos.x, adjustedPos.y);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Click-to-place element creation (fallback or for specific tools)
    const handleStageClick = (e: any) => {
        // If we're naming an element, finish naming first
        if (namingElementId) {
            finishNaming(true);
            return;
        }

        // If we're editing text, finish editing first
        if (editingTextId) {
            finishTextEdit(true);
            return;
        }

        if (tool === 'select') {
            if (e.target === e.target.getStage()) {
                setSelectedElementIds([]);
            }
            return;
        }

        // Don't create elements during freehand drawing
        if (tool === 'freehand' && isDrawing) return;

        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Adjust for zoom
        const adjustedPos = {
            x: (pos.x - stagePosition.x) / scale,
            y: (pos.y - stagePosition.y) / scale,
        };

        // For freehand, start drawing
        if (tool === 'freehand') {
            setIsDrawing(true);
            setFreehandPoints([adjustedPos.x, adjustedPos.y]);
            return;
        }

        // For other tools, create element
        createElement(tool as ElementType, adjustedPos.x, adjustedPos.y);
    };

    const handleStageMouseMove = (e: any) => {
        if (!isDrawing || tool !== 'freehand') return;

        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Adjust for zoom
        const adjustedPos = {
            x: (pos.x - stagePosition.x) / scale,
            y: (pos.y - stagePosition.y) / scale,
        };

        setFreehandPoints(prev => [...prev, adjustedPos.x, adjustedPos.y]);
    };

    const handleStageMouseUp = () => {
        if (!isDrawing || tool !== 'freehand') return;

        if (freehandPoints.length > 4) {
            const id = Date.now().toString();
            const newElement: MapElement = {
                id,
                type: 'freehand',
                name: 'Freehand',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                freehandPoints: [...freehandPoints],
                zIndex: elements.length,
                showNameOn: 'layers', // Default to layers only
                ...defaultElement,
            } as MapElement;

            setElements([...elements, newElement]);
            setSelectedElementIds([newElement.id]);

            // Don't auto-switch to select mode - let user manually choose when to switch tools
        }

        setIsDrawing(false);
        setFreehandPoints([]);
    };

    const getDefaultName = (type: ElementType): string => {
        const names: Record<ElementType, string> = {
            rectangle: 'Rectangle',
            circle: 'Circle',
            line: 'Line',
            arrow: 'Arrow',
            polygon: 'Polygon',
            text: 'Text',
            freehand: 'Freehand',
            triangle: 'Triangle',
            trapezoid: 'Trapezoid',
            parallelogram: 'Parallelogram',
            'smart-pin': 'Smart Pin',
            'static-pin': 'Static Pin',
        };
        return names[type] || 'Element';
    };

    // Finish inline naming
    const finishNaming = (save: boolean) => {
        if (namingElementId) {
            if (save && namingValue.trim()) {
                updateElement(namingElementId, { name: namingValue.trim() });
            }
            setNamingElementId(null);
            setNamingValue('');
        }
    };

    // Finish text editing
    const finishTextEdit = (save: boolean) => {
        if (editingTextId) {
            if (save && editingTextValue.trim()) {
                updateElement(editingTextId, { text: editingTextValue.trim() });
            }
            setEditingTextId(null);
            setEditingTextValue('');
        }
    };

    // Double-click to rename or edit text
    const handleElementDoubleClick = (elementId: string) => {
        const element = elements.find(el => el.id === elementId);
        if (element) {
            if (element.type === 'text') {
                // For text elements, open text editing
                const center = getElementCenter(element);
                setNamingPosition(center);
                setEditingTextValue(element.text || '');
                setEditingTextId(elementId);
            } else {
                // For other elements, open rename
                const center = getElementCenter(element);
                setNamingPosition(center);
                setNamingValue(element.name);
                setNamingElementId(elementId);
            }
        }
    };

    // Save current state to history (for undo/redo)
    const saveToHistory = (newElements: MapElement[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(JSON.parse(JSON.stringify(newElements))); // Deep copy
        // Limit history to 50 steps
        if (newHistory.length > 50) {
            newHistory.shift();
            setHistory(newHistory);
            setHistoryStep(newHistory.length - 1);
        } else {
            setHistory(newHistory);
            setHistoryStep(newHistory.length - 1);
        }
    };

    // Undo
    const handleUndo = useCallback(() => {
        if (historyStep > 0) {
            isUndoRedoRef.current = true;
            setHistoryStep(historyStep - 1);
            setElements(JSON.parse(JSON.stringify(history[historyStep - 1])));
            setSelectedElementIds([]);
            toast.success('Undone');
        } else {
            toast.error('Nothing to undo');
        }
    }, [historyStep, history]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyStep < history.length - 1) {
            isUndoRedoRef.current = true;
            setHistoryStep(historyStep + 1);
            setElements(JSON.parse(JSON.stringify(history[historyStep + 1])));
            setSelectedElementIds([]);
            toast.success('Redone');
        } else {
            toast.error('Nothing to redo');
        }
    }, [historyStep, history]);

    // Cut (copy + delete)
    const handleCut = useCallback(() => {
        if (selectedElementIds.length > 0) {
            const elementsToCut = elements.filter(el => selectedElementIds.includes(el.id));
            if (elementsToCut.length > 0) {
                setCopiedElements(elementsToCut);
                const newElements = elements.filter(el => !selectedElementIds.includes(el.id));
                setElements(newElements);
                // Note: saveToHistory is handled by the useEffect that tracks element changes
                setSelectedElementIds([]);
                toast.success(`Cut ${elementsToCut.length} element${elementsToCut.length > 1 ? 's' : ''}`);
            }
        }
    }, [selectedElementIds, elements]);

    // Select All
    const handleSelectAll = useCallback(() => {
        const visibleElementIds = elements.filter(el => el.visible).map(el => el.id);
        setSelectedElementIds(visibleElementIds);
        toast.success(`Selected ${visibleElementIds.length} element${visibleElementIds.length > 1 ? 's' : ''}`);
    }, [elements]);

    const handleDeleteElement = useCallback((id: string) => {
        setElements(prev => prev.filter(el => el.id !== id));
        setSelectedElementIds(prev => prev.filter(sid => sid !== id));
        toast.success('Element deleted');
    }, []);

    // Deep clone a single element
    const deepCloneElement = useCallback((el: MapElement): MapElement => {
        return {
            ...el,
            // Deep clone arrays
            points: el.points ? [...el.points] : undefined,
            freehandPoints: el.freehandPoints ? [...el.freehandPoints] : undefined,
            // Deep clone metadata object
            metadata: el.metadata ? { ...el.metadata } : undefined,
        };
    }, []);

    const handleCopy = useCallback(() => {
        if (selectedElementIds.length > 0) {
            const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
            if (elementsToCopy.length > 0) {
                // DEEP CLONE all elements to capture their CURRENT positions
                const clonedElements = elementsToCopy.map(el => deepCloneElement(el));
                setCopiedElements(clonedElements);
                // Reset paste count when copying new elements
                setPasteCount(0);
                toast.success(`Copied ${clonedElements.length} element${clonedElements.length > 1 ? 's' : ''}`);
            }
        }
    }, [selectedElementIds, elements, deepCloneElement]);

    const handlePaste = useCallback(() => {
        if (copiedElements.length === 0) {
            toast.error('No elements to paste');
            return;
        }

        const PASTE_OFFSET = 30; // Fixed offset for each paste

        // Increment paste count first, then use it to calculate offset
        // This ensures first paste = 30px offset, second paste = 60px offset, etc.
        const currentPasteCount = pasteCount + 1;
        setPasteCount(currentPasteCount);

        // Simple offset based on paste count
        const offset = PASTE_OFFSET * currentPasteCount;

        const newPastedElements: MapElement[] = [];
        const baseTimestamp = Date.now();

        copiedElements.forEach((copiedElement, index) => {
            // Generate truly unique ID
            const id = `paste-${baseTimestamp}-${index}-${Math.random().toString(36).substring(2, 11)}`;

            // Deep clone the element first
            const newElement: MapElement = deepCloneElement(copiedElement);

            // Set new ID and zIndex
            newElement.id = id;
            newElement.zIndex = elements.length + newPastedElements.length;

            // Apply offset based on element type
            if (newElement.type === 'line' || newElement.type === 'arrow') {
                // For lines/arrows, offset all points
                if (newElement.points) {
                    newElement.points = newElement.points.map((p, i) =>
                        i % 2 === 0 ? p + offset : p + offset
                    );
                }
            } else if (newElement.type === 'freehand') {
                // For freehand, offset all points
                if (newElement.freehandPoints) {
                    newElement.freehandPoints = newElement.freehandPoints.map((p, i) =>
                        i % 2 === 0 ? p + offset : p + offset
                    );
                }
            } else {
                // For ALL other shapes (rectangle, circle, triangle, polygon, pins, text, etc.)
                // Simply add offset to x and y
                newElement.x = copiedElement.x + offset;
                newElement.y = copiedElement.y + offset;
            }

            newPastedElements.push(newElement);
        });

        // Add all new elements at once
        setElements(prev => {
            const newElements = [...prev, ...newPastedElements];
            // Update ref immediately so drag handlers have latest data
            elementsRef.current = newElements;
            return newElements;
        });

        // Select all newly pasted elements
        const newSelectedIds = newPastedElements.map(el => el.id);
        selectedElementIdsRef.current = newSelectedIds; // Update ref immediately
        setSelectedElementIds(newSelectedIds);

        toast.success(`Pasted ${newPastedElements.length} element${newPastedElements.length > 1 ? 's' : ''}`);
    }, [copiedElements, elements, pasteCount, deepCloneElement]);

    // Keyboard shortcuts - must be after handler definitions to avoid hoisting issues
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle shortcuts when typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === 'Escape') {
                    // Close any open inputs
                    if (namingElementId) {
                        finishNaming(false);
                    }
                    if (editingTextId) {
                        finishTextEdit(false);
                    }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                    if (namingElementId) {
                        e.preventDefault();
                        finishNaming(true);
                    }
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'v':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+V: Paste
                        e.preventDefault();
                        handlePaste();
                    } else {
                        setTool('select');
                    }
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            // Ctrl+Shift+Z: Redo
                            handleRedo();
                        } else {
                            // Ctrl+Z: Undo
                            handleUndo();
                        }
                    }
                    break;
                case 'y':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Y: Redo
                        e.preventDefault();
                        handleRedo();
                    }
                    break;
                case 'x':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+X: Cut
                        e.preventDefault();
                        handleCut();
                    }
                    break;
                case 'a':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+A: Select All
                        e.preventDefault();
                        handleSelectAll();
                    }
                    break;
                case 'c':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+C: Copy
                        e.preventDefault();
                        handleCopy();
                    }
                    break;
                case 'delete':
                case 'backspace':
                    if (selectedElementIds.length > 0 && !editingTextId && !namingElementId) {
                        // Delete all selected elements
                        selectedElementIds.forEach(id => handleDeleteElement(id));
                    }
                    break;
                case 'escape':
                    setSelectedElementIds([]);
                    setEditingTextId(null);
                    setNamingElementId(null);
                    setTool('select');
                    break;
                case '=':
                case '+':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleZoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleZoomOut();
                    }
                    break;
                case '0':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleResetZoom();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        selectedElementIds,
        editingTextId,
        namingElementId,
        handleUndo,
        handleRedo,
        handleCopy,
        handlePaste,
        handleCut,
        handleSelectAll,
        handleDeleteElement,
        handleZoomIn,
        handleZoomOut,
        handleResetZoom,
    ]);

    const handleDeleteMap = async () => {
        if (!confirm('Are you sure you want to delete the map?')) return;

        await saveElements(elements);

        setLoading(true);
        try {
            await fetch(`${API_URL}/api/admin/stores/${storeId}/map/image`, { method: 'DELETE' });
            setMapImageUrl(null);
            setMapImage(null);
            setElements([]);
            setSelectedElementIds([]);
            setMode('choice');
            toast.success('Map deleted successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete map');
        } finally {
            setLoading(false);
        }
    };

    const updateElement = (id: string, updates: Partial<MapElement>) => {
        // Use callback form to avoid stale state issues
        setElements(prev => {
            const newElements = prev.map(el => el.id === id ? { ...el, ...updates } : el);
            // Update ref immediately so subsequent operations have latest data
            elementsRef.current = newElements;
            return newElements;
        });
    };

    // Batch update multiple elements at once (avoids stale state issues)
    const updateMultipleElements = (updates: Map<string, Partial<MapElement>>) => {
        setElements(prev => {
            const newElements = prev.map(el => {
                const update = updates.get(el.id);
                return update ? { ...el, ...update } : el;
            });
            // Update ref immediately so subsequent operations have latest data
            elementsRef.current = newElements;
            return newElements;
        });
    };

    const handleToggleVisibility = (id: string) => {
        updateElement(id, { visible: !elements.find(el => el.id === id)?.visible });
    };

    const handleToggleLock = (id: string) => {
        updateElement(id, { locked: !elements.find(el => el.id === id)?.locked });
    };

    const handleReorderElements = (newElements: MapElement[]) => {
        setElements(newElements);
    };

    const selectedElement = selectedElementIds.length === 1 ? elements.find(el => el.id === selectedElementIds[0]) || null : null;

    // Get trapezoid points
    const getTrapezoidPoints = (width: number, height: number): number[] => {
        const topOffset = width * 0.2;
        return [
            topOffset, 0,
            width - topOffset, 0,
            width, height,
            0, height,
        ];
    };

    // Get parallelogram points
    const getParallelogramPoints = (width: number, height: number): number[] => {
        const offset = width * 0.2;
        return [
            offset, 0,
            width, 0,
            width - offset, height,
            0, height,
        ];
    };

    // Get proportional pin points for smart-pin and static-pin
    // The pin has a square top and a V-shaped bottom anchor
    // Coordinates use negative Y (upward from anchor point at 0,0)
    const getPinPoints = (width: number, height: number): number[] => {
        // Calculate proportional values based on pin size
        // Base proportions from default 40x50: cornerRadius=5, offsets: 10, 15
        const cornerRadius = width * 0.125; // 5/40 = 12.5% of width
        const topEdgeOffset = height * 0.2; // 10/50 = 20% of height
        const topCornerOffset = height * 0.3; // 15/50 = 30% of height
        const bottomSquareY = height * 0.3; // 15/50 = 30% of height from bottom
        const vStartY = height * 0.2; // 10/50 = 20% of height from bottom
        const vWidth = width * 0.125; // 5/40 = 12.5% of width from center
        
        // Pin structure: square top with rounded corners, vertical sides, V-shaped bottom
        // Y coordinates are negative (upward from anchor point)
        return [
            // Top-left rounded corner start
            -width / 2 + cornerRadius, -height + topEdgeOffset,
            // Top-right rounded corner start
            width / 2 - cornerRadius, -height + topEdgeOffset,
            // Top-right corner point (outer corner)
            width / 2, -height + topCornerOffset,
            // Right side - goes down to bottom of square
            width / 2, -bottomSquareY,
            // Right side - transition to V (inner corner)
            width / 2 - cornerRadius, -vStartY,
            // V tip (right side)
            vWidth, -vStartY,
            // V point (bottom center at 0, 0)
            0, 0,
            // V tip (left side)
            -vWidth, -vStartY,
            // Left side - transition from V (inner corner)
            -width / 2 + cornerRadius, -vStartY,
            // Left side - goes up to bottom of square
            -width / 2, -bottomSquareY,
            // Top-left corner point (outer corner)
            -width / 2, -height + topCornerOffset,
            // Close path back to start
            -width / 2 + cornerRadius, -height + topEdgeOffset,
        ];
    };

    // Render element
    const renderElement = (element: MapElement) => {
        if (!element.visible) return null;

        const isSelected = selectedElementIds.includes(element.id);
        const commonProps = {
            id: element.id,
            x: element.x,
            y: element.y,
            rotation: element.rotation,
            draggable: !element.locked && tool === 'select',
            onClick: () => {
                if (tool === 'select') {
                    // Use ref to get latest selection (avoid stale closure)
                    const currentlySelected = selectedElementIdsRef.current.includes(element.id);
                    // If clicking on an already-selected element, keep the multi-selection
                    // Otherwise, select only this element
                    if (!currentlySelected) {
                        setSelectedElementIds([element.id]);
                    }
                }
            },
            onTap: () => {
                if (tool === 'select') {
                    // Use ref to get latest selection (avoid stale closure)
                    const currentlySelected = selectedElementIdsRef.current.includes(element.id);
                    // Same logic for touch
                    if (!currentlySelected) {
                        setSelectedElementIds([element.id]);
                    }
                }
            },
            onDragStart: () => {
                // Use refs to get latest values (avoid stale closure)
                const currentSelectedIds = selectedElementIdsRef.current;
                const currentlySelected = currentSelectedIds.includes(element.id);

                // If dragging an unselected element, select only that one
                // If dragging a selected element, keep all selected (for group drag)
                if (!currentlySelected) {
                    setSelectedElementIds([element.id]);
                }

                // Store the starting positions of all selected elements for group drag
                if (currentSelectedIds.length > 1 && currentlySelected) {
                    dragStartPositionsRef.current.clear();
                    currentSelectedIds.forEach(id => {
                        const el = elementsRef.current.find(e => e.id === id);
                        if (el) {
                            if (el.type === 'line' || el.type === 'arrow') {
                                // For lines/arrows, store the first point as reference
                                const points = el.points || [0, 0, 100, 0];
                                dragStartPositionsRef.current.set(id, { x: points[0], y: points[1] });
                            } else if (el.type === 'freehand') {
                                // For freehand, store the first point as reference
                                const points = el.freehandPoints || [];
                                dragStartPositionsRef.current.set(id, {
                                    x: points[0] || el.x,
                                    y: points[1] || el.y
                                });
                            } else {
                                // For regular shapes, store the element position
                                dragStartPositionsRef.current.set(id, { x: el.x, y: el.y });
                            }
                        }
                    });
                } else {
                    // Store single element start position
                    const currentEl = elementsRef.current.find(e => e.id === element.id);
                    if (currentEl) {
                        if (currentEl.type === 'line' || currentEl.type === 'arrow') {
                            const points = currentEl.points || [0, 0, 100, 0];
                            dragStartPositionsRef.current.set(currentEl.id, { x: points[0], y: points[1] });
                        } else if (currentEl.type === 'freehand') {
                            const points = currentEl.freehandPoints || [];
                            dragStartPositionsRef.current.set(currentEl.id, {
                                x: points[0] || currentEl.x,
                                y: points[1] || currentEl.y
                            });
                        } else {
                            dragStartPositionsRef.current.set(currentEl.id, { x: currentEl.x, y: currentEl.y });
                        }
                    }
                }
            },
            onDragEnd: (e: any) => {
                // Use refs to get latest values (avoid stale closure)
                const currentSelectedIds = selectedElementIdsRef.current;
                const currentlySelected = currentSelectedIds.includes(element.id);

                // Get the current element from ref to ensure we have the latest data
                const currentElement = elementsRef.current.find(el => el.id === element.id);
                if (!currentElement) return;

                // Calculate delta from the drag start position
                const startPos = dragStartPositionsRef.current.get(element.id);
                if (!startPos) return;

                let deltaX: number, deltaY: number;

                if (currentElement.type === 'line' || currentElement.type === 'arrow') {
                    // For lines/arrows, the Group starts at (0,0) and points are absolute
                    // When dragged, e.target.x()/y() gives us the delta directly
                    deltaX = e.target.x();
                    deltaY = e.target.y();
                } else if (currentElement.type === 'freehand') {
                    // For freehand, same as lines - Group starts at (0,0)
                    deltaX = e.target.x();
                    deltaY = e.target.y();
                } else {
                    // For regular shapes, calculate delta from position
                    // e.target.x()/y() gives the new absolute position
                    deltaX = e.target.x() - startPos.x;
                    deltaY = e.target.y() - startPos.y;
                }

                // If multiple elements are selected, move all of them using batch update
                if (currentSelectedIds.length > 1 && currentlySelected) {
                    const updates = new Map<string, Partial<MapElement>>();

                    currentSelectedIds.forEach(id => {
                        const el = elementsRef.current.find(e => e.id === id);
                        if (!el) return;

                        const elStartPos = dragStartPositionsRef.current.get(id);
                        if (!elStartPos) return;

                        if (el.type === 'line' || el.type === 'arrow') {
                            // For line/arrow, offset all points by the same delta
                            const points = el.points || [0, 0, 100, 0];
                            const newPoints = points.map((p, i) =>
                                i % 2 === 0 ? p + deltaX : p + deltaY
                            );
                            updates.set(el.id, { points: newPoints });
                        } else if (el.type === 'freehand') {
                            // For freehand, offset all points by the same delta
                            const freehandPoints = el.freehandPoints || [];
                            const newPoints = freehandPoints.map((p, i) =>
                                i % 2 === 0 ? p + deltaX : p + deltaY
                            );
                            updates.set(el.id, { freehandPoints: newPoints });
                        } else {
                            // For regular shapes, offset position by the same delta
                            updates.set(el.id, {
                                x: elStartPos.x + deltaX,
                                y: elStartPos.y + deltaY,
                            });
                        }
                    });

                    // Apply all updates at once
                    updateMultipleElements(updates);

                    // Reset the dragged element's position since we updated via updateElement
                    if (currentElement.type === 'line' || currentElement.type === 'arrow' || currentElement.type === 'freehand') {
                        // For line-based elements, reset to (0,0)
                        e.target.x(0);
                        e.target.y(0);
                    } else {
                        // For regular shapes, reset to the updated position (startPos + delta)
                        const draggedStartPos = dragStartPositionsRef.current.get(element.id);
                        if (draggedStartPos) {
                            e.target.x(draggedStartPos.x + deltaX);
                            e.target.y(draggedStartPos.y + deltaY);
                        }
                    }
                } else {
                    // Single element drag
                    if (currentElement.type === 'line' || currentElement.type === 'arrow') {
                        // For line/arrow, we need to offset the points by the drag delta
                        const points = currentElement.points || [0, 0, 100, 0];
                        const newPoints = [];
                        for (let i = 0; i < points.length; i += 2) {
                            newPoints.push(points[i] + deltaX);
                            newPoints.push(points[i + 1] + deltaY);
                        }
                        updateElement(currentElement.id, { points: newPoints });
                        // Reset the group position
                        e.target.x(0);
                        e.target.y(0);
                    } else if (currentElement.type === 'freehand') {
                        const freehandPoints = currentElement.freehandPoints || [];
                        const newPoints = [];
                        for (let i = 0; i < freehandPoints.length; i += 2) {
                            newPoints.push(freehandPoints[i] + deltaX);
                            newPoints.push(freehandPoints[i + 1] + deltaY);
                        }
                        updateElement(currentElement.id, { freehandPoints: newPoints });
                        e.target.x(0);
                        e.target.y(0);
                    } else {
                        updateElement(currentElement.id, {
                            x: startPos.x + deltaX,
                            y: startPos.y + deltaY,
                        });
                    }
                }

                // Clear drag start positions
                dragStartPositionsRef.current.clear();
            },
            onTransformEnd: (e: any) => {
                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Reset scale
                node.scaleX(1);
                node.scaleY(1);

                if (element.type === 'line' || element.type === 'arrow' || element.type === 'freehand') {
                    // For line-based elements, we need to scale the points
                    const points = element.points || element.freehandPoints || [];
                    const newPoints = [];
                    for (let i = 0; i < points.length; i += 2) {
                        newPoints.push(points[i] * scaleX);
                        newPoints.push(points[i + 1] * scaleY);
                    }

                    const updates: Partial<MapElement> = {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                    };

                    if (element.type === 'freehand') {
                        updates.freehandPoints = newPoints;
                    } else {
                        updates.points = newPoints;
                    }

                    updateElement(element.id, updates);
                } else {
                    // For shapes, update width and height
                    const newWidth = Math.max(5, element.width * scaleX);
                    const newHeight = Math.max(5, element.height * scaleY);

                    updateElement(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: newWidth,
                        height: newHeight,
                        rotation: node.rotation(),
                    });
                }
            },
            onDblClick: () => handleElementDoubleClick(element.id),
        };

        // Render name label if enabled
        const renderLabel = () => {
            if (!element.name || element.showNameOn === 'none' || element.showNameOn === 'layers') return null;

            let x = 0;
            let y = 0;
            let width = element.width;
            let height = element.height;

            if (element.type === 'circle' || element.type === 'polygon' || element.type === 'triangle') {
                // For centered shapes, the group origin is the center
                // So the bounding box for text should be centered around 0,0
                x = -element.width / 2;
                y = -element.height / 2;
            } else {
                // For top-left shapes (rect), the group origin is top-left
                x = 0;
                y = 0;
            }

            // Apply custom offsets if any
            x += (element.labelOffsetX || 0);
            y += (element.labelOffsetY || 0);

            return (
                <KonvaText
                    text={element.name}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fontSize={element.fontSize || 14} // Use element font size or default
                    fontFamily={element.fontFamily}
                    fontStyle={element.fontWeight}
                    fill={element.type === 'text' ? element.fillColor : '#000000'} // Use fill color for text tool, black for labels
                    align="center"
                    verticalAlign="middle"
                    listening={false} // Let clicks pass through to the shape
                />
            );
        };

        switch (element.type) {
            case 'rectangle':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Rect
                            width={element.width}
                            height={element.height}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            cornerRadius={element.cornerRadius}
                        />
                        {/* Selection highlight */}
                        {isSelected && (
                            <Rect
                                width={element.width}
                                height={element.height}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                cornerRadius={element.cornerRadius}
                                listening={false}
                            />
                        )}
                        {renderLabel()}
                    </Group>
                );
            case 'circle':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Circle
                            radius={element.width / 2}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'triangle':
                return (
                    <Group key={element.id} {...commonProps}>
                        <RegularPolygon
                            sides={3}
                            radius={element.width / 2}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'trapezoid':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={getTrapezoidPoints(element.width, element.height)}
                            closed={true}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            lineJoin="round"
                            cornerRadius={element.cornerRadius || 0}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'parallelogram':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={getParallelogramPoints(element.width, element.height)}
                            closed={true}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            lineJoin="round"
                            cornerRadius={element.cornerRadius || 0}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'polygon':
                return (
                    <Group key={element.id} {...commonProps}>
                        <RegularPolygon
                            sides={element.sides || 6}
                            radius={element.width / 2}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'line':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={element.points || [0, 0, 100, 0]}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            hitStrokeWidth={40}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'arrow':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Arrow
                            points={element.points || [0, 0, 100, 0]}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            fill={element.strokeColor}
                            hitStrokeWidth={40}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'text':
                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Background rectangle with corner radius */}
                        {(element.cornerRadius ?? 0) > 0 && (
                            <Rect
                                width={element.width}
                                height={element.height}
                                fill={element.fillColor}
                                opacity={0.1}
                                cornerRadius={element.cornerRadius || 0}
                            />
                        )}
                        <KonvaText
                            text={element.text || 'Text'}
                            fontSize={element.fontSize}
                            fontFamily={element.fontFamily}
                            fontStyle={element.fontWeight}
                            fill={element.fillColor}
                            align={element.textAlign}
                            width={element.width}
                            padding={10}
                        />
                    </Group>
                );
            case 'freehand':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={element.freehandPoints || []}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeOpacity={element.strokeOpacity}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            hitStrokeWidth={20}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'smart-pin':
                const smartPinPoints = getPinPoints(element.width, element.height);
                // Calculate proportional inner rectangle dimensions
                const innerRectWidth = element.width * 0.5; // 50% of pin width
                const innerRectHeight = element.height * 0.35; // 35% of pin height
                const innerRectY = -element.height + element.height * 0.25; // Position in upper part
                const innerRectRadius = Math.min(innerRectWidth, innerRectHeight) * 0.15; // Proportional corner radius
                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Pin shape - rounded rectangle with V anchor pointing down */}
                        <Line
                            points={smartPinPoints}
                            closed={true}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            lineJoin="round"
                        />
                        {/* Inner centered rounded rectangle - distinguishes smart pins */}
                        <Rect
                            x={-innerRectWidth / 2}
                            y={innerRectY}
                            width={innerRectWidth}
                            height={innerRectHeight}
                            fill="#ffffff"
                            opacity={0.9}
                            cornerRadius={innerRectRadius}
                            listening={false}
                        />
                        {/* Selection highlight */}
                        {isSelected && (
                            <Line
                                points={smartPinPoints}
                                closed={true}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                lineJoin="round"
                                listening={false}
                            />
                        )}
                        {renderLabel()}
                    </Group>
                );
            case 'static-pin':
                const staticPinPoints = getPinPoints(element.width, element.height);
                // Use custom font size from properties, or fall back to default
                const labelFontSize = element.pinLabelFontSize || 12;
                // The rectangular box spans from y=-0.8*height (top) to y=-0.3*height (bottom)
                // Center of the box is at y = -0.55*height
                const boxTop = -element.height * 0.8;
                const boxBottom = -element.height * 0.3;
                const boxCenterY = (boxTop + boxBottom) / 2;
                const labelColor = element.pinLabelColor || '#ffffff';
                const labelFontWeight = element.pinLabelFontWeight || 'bold';
                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Pin shape - rounded rectangle with V anchor pointing down */}
                        <Line
                            points={staticPinPoints}
                            closed={true}
                            fill={element.fillColor}
                            opacity={element.fillOpacity}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            lineJoin="round"
                        />
                        {/* Pin label - centered in the rectangular box portion */}
                        <KonvaText
                            text={element.pinLabel || 'Click to edit'}
                            x={-element.width / 2 + 2}
                            y={boxCenterY - labelFontSize / 2}
                            width={element.width - 4}
                            fontSize={labelFontSize}
                            fontFamily="Verdana, sans-serif"
                            fontStyle={element.pinLabel ? labelFontWeight : 'normal'}
                            fill={element.pinLabel ? labelColor : 'rgba(255,255,255,0.6)'}
                            align="center"
                            wrap="word"
                            ellipsis={true}
                            listening={false}
                        />
                        {/* Selection highlight */}
                        {isSelected && (
                            <Line
                                points={staticPinPoints}
                                closed={true}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                lineJoin="round"
                                listening={false}
                            />
                        )}
                        {renderLabel()}
                    </Group>
                );
            default:
                return null;
        }
    };

    if (mode === 'choice') {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] gap-8 bg-muted/20 rounded-lg border-2 border-dashed border-border">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Create Store Map</h2>
                    <p className="text-muted-foreground">Choose how you want to create your store map</p>
                </div>

                <div className="flex gap-6">
                    <Card className="w-64 hover:border-primary cursor-pointer transition-colors" onClick={() => setMode('builder')}>
                        <CardHeader>
                            <CardTitle className="flex flex-col items-center gap-4">
                                <Hammer className="h-12 w-12 text-primary" />
                                Build from Scratch
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center text-sm text-muted-foreground">
                            Use our drag-and-drop editor to create your store layout
                        </CardContent>
                    </Card>

                    <Card className="w-64 hover:border-primary cursor-pointer transition-colors relative overflow-hidden">
                        <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload}
                            disabled={uploading}
                        />
                        <CardHeader>
                            <CardTitle className="flex flex-col items-center gap-4">
                                <Upload className="h-12 w-12 text-primary" />
                                Upload Image
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center text-sm text-muted-foreground">
                            Upload an existing floor plan image to trace over
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col border rounded-lg overflow-hidden bg-background">
            {/* Top Bar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setMode('choice')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <h2 className="font-semibold">Map Editor</h2>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowGrid(!showGrid)}>
                        <Grid className="h-4 w-4 mr-2" />
                        {showGrid ? 'Hide Grid' : 'Show Grid'}
                    </Button>
                    {mapImageUrl && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteMap}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Map
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleResetZoom}>
                        {Math.round(scale * 100)}%
                    </Button>
                    <Button 
                        onClick={handleManualSave} 
                        size="sm" 
                        disabled={saving}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Tools */}
                <Sidebar
                    activeTool={tool}
                    onToolChange={setTool}
                    onDeleteSelected={() => selectedElementIds.length > 0 && selectedElementIds.forEach(id => handleDeleteElement(id))}
                    hasSelection={selectedElementIds.length > 0}
                />

                {/* Center - Canvas */}
                <div
                    className="flex-1 bg-muted/10 relative overflow-hidden"
                    ref={canvasContainerRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    {/* Floating Zoom Controls */}
                    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 bg-card border border-border rounded-lg shadow-sm p-1">
                        <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleResetZoom}>
                            <Maximize className="h-4 w-4" />
                        </Button>
                    </div>

                    <Stage
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        scaleX={scale}
                        scaleY={scale}
                        x={stagePosition.x}
                        y={stagePosition.y}
                        draggable={false}
                        onWheel={handleWheel}
                        onMouseDown={(e) => {
                            // Right-click to drag canvas
                            if (e.evt.button === 2) {
                                setIsRightMouseDown(true);
                                e.evt.preventDefault();
                            } else {
                                // Left-click - check if clicking on stage background or empty space
                                const target = e.target;
                                const stage = target.getStage();

                                // Consider it empty if clicking on Stage, Layer, or background elements (grid, image)
                                const clickedOnEmpty =
                                    target === stage ||
                                    target.getType() === 'Layer' ||
                                    target.name() === 'background-image' ||
                                    target.name() === 'grid-line';

                                if (clickedOnEmpty && tool === 'select') {
                                    // Clear any existing selection when starting a new selection box
                                    setSelectedElementIds([]);

                                    // Start selection box
                                    const pointerPos = stage.getPointerPosition();
                                    if (pointerPos) {
                                        const adjustedPos = {
                                            x: (pointerPos.x - stagePosition.x) / scale,
                                            y: (pointerPos.y - stagePosition.y) / scale,
                                        };
                                        setSelectionBox({
                                            startX: adjustedPos.x,
                                            startY: adjustedPos.y,
                                            endX: adjustedPos.x,
                                            endY: adjustedPos.y,
                                            active: true,
                                        });
                                    }
                                } else {
                                    handleStageClick(e);
                                }
                            }
                        }}
                        onMouseMove={(e) => {
                            if (isRightMouseDown) {
                                // Pan the canvas
                                const stage = e.target.getStage();
                                if (stage) {
                                    const deltaX = e.evt.movementX;
                                    const deltaY = e.evt.movementY;
                                    setStagePosition(prev => ({
                                        x: prev.x + deltaX,
                                        y: prev.y + deltaY,
                                    }));
                                }
                            } else if (selectionBox?.active) {
                                // Update selection box
                                const stage = e.target.getStage();
                                const pointerPos = stage.getPointerPosition();
                                if (pointerPos) {
                                    const adjustedPos = {
                                        x: (pointerPos.x - stagePosition.x) / scale,
                                        y: (pointerPos.y - stagePosition.y) / scale,
                                    };
                                    setSelectionBox(prev => prev ? {
                                        ...prev,
                                        endX: adjustedPos.x,
                                        endY: adjustedPos.y,
                                    } : null);
                                }
                            } else {
                                handleStageMouseMove(e);
                            }
                        }}
                        onMouseUp={(e) => {
                            if (e.evt.button === 2) {
                                setIsRightMouseDown(false);
                            } else if (selectionBox?.active) {
                                // Finalize selection box - find all elements within bounds
                                const box = selectionBox;
                                const minX = Math.min(box.startX, box.endX);
                                const maxX = Math.max(box.startX, box.endX);
                                const minY = Math.min(box.startY, box.endY);
                                const maxY = Math.max(box.startY, box.endY);

                                // Find elements that intersect with selection box
                                const selectedElements = elements.filter(el => {
                                    // Default to visible if not specified
                                    if (el.visible === false) return false;

                                    // For point-based elements (line, arrow, freehand)
                                    if (el.type === 'line' || el.type === 'arrow') {
                                        const points = el.points || [0, 0, 100, 0];
                                        // Check if any point is within bounds
                                        for (let i = 0; i < points.length; i += 2) {
                                            const px = points[i];
                                            const py = points[i + 1];
                                            if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
                                                return true;
                                            }
                                        }
                                        return false;
                                    } else if (el.type === 'freehand') {
                                        const points = el.freehandPoints || [];
                                        for (let i = 0; i < points.length; i += 2) {
                                            const px = points[i];
                                            const py = points[i + 1];
                                            if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
                                                return true;
                                            }
                                        }
                                        return false;
                                    }

                                    // For position-based elements
                                    let elMinX, elMaxX, elMinY, elMaxY;

                                    if (el.type === 'circle' || el.type === 'polygon' || el.type === 'triangle') {
                                        // Centered shapes
                                        const radius = el.width / 2;
                                        elMinX = el.x - radius;
                                        elMaxX = el.x + radius;
                                        elMinY = el.y - radius;
                                        elMaxY = el.y + radius;
                                    } else {
                                        // Top-left anchored shapes
                                        elMinX = el.x;
                                        elMaxX = el.x + el.width;
                                        elMinY = el.y;
                                        elMaxY = el.y + el.height;
                                    }

                                    // Check intersection
                                    return !(elMaxX < minX || elMinX > maxX || elMaxY < minY || elMinY > maxY);
                                });

                                console.log('Selection box complete:', {
                                    box: { minX, maxX, minY, maxY },
                                    totalElements: elements.length,
                                    selectedCount: selectedElements.length,
                                    selectedIds: selectedElements.map(el => el.id)
                                });

                                // Select all elements found
                                if (selectedElements.length > 0) {
                                    const newSelectedIds = selectedElements.map(el => el.id);
                                    selectedElementIdsRef.current = newSelectedIds; // Update ref immediately
                                    setSelectedElementIds(newSelectedIds);
                                    toast.success(`Selected ${selectedElements.length} element${selectedElements.length > 1 ? 's' : ''}`);
                                } else {
                                    selectedElementIdsRef.current = []; // Update ref immediately
                                    setSelectedElementIds([]);
                                }

                                setSelectionBox(null);
                            } else {
                                handleStageMouseUp();
                            }
                        }}
                        onContextMenu={(e) => {
                            // Prevent default right-click context menu
                            e.evt.preventDefault();
                        }}
                        ref={stageRef}
                        style={{ background: '#ffffff', cursor: isRightMouseDown ? 'grabbing' : 'default' }}
                    >
                        <Layer>
                            {/* Grid */}
                            {showGrid && (
                                <Group name="grid-group" listening={false}>
                                    {Array.from({ length: Math.ceil(CANVAS_WIDTH / 50) }).map((_, i) => (
                                        <Line
                                            key={`v-${i}`}
                                            name="grid-line"
                                            points={[i * 50, 0, i * 50, CANVAS_HEIGHT]}
                                            stroke="#9ca3af"
                                            strokeWidth={1}
                                            listening={false}
                                        />
                                    ))}
                                    {/* Right edge */}
                                    <Line
                                        name="grid-line"
                                        points={[CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT]}
                                        stroke="#9ca3af"
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                    {Array.from({ length: Math.ceil(CANVAS_HEIGHT / 50) }).map((_, i) => (
                                        <Line
                                            key={`h-${i}`}
                                            name="grid-line"
                                            points={[0, i * 50, CANVAS_WIDTH, i * 50]}
                                            stroke="#9ca3af"
                                            strokeWidth={1}
                                            listening={false}
                                        />
                                    ))}
                                    {/* Bottom edge */}
                                    <Line
                                        name="grid-line"
                                        points={[0, CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT]}
                                        stroke="#9ca3af"
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                </Group>
                            )}

                            {/* Background Image */}
                            {mapImage && (
                                <KonvaImage
                                    name="background-image"
                                    image={mapImage}
                                    width={CANVAS_WIDTH}
                                    height={CANVAS_HEIGHT}
                                    opacity={0.9}
                                    listening={false}
                                />
                            )}

                            {/* Elements */}
                            {elements.map(renderElement)}

                            {/* Freehand drawing preview */}
                            {isDrawing && tool === 'freehand' && freehandPoints.length > 0 && (
                                <Line
                                    points={freehandPoints}
                                    stroke="#1d4ed8"
                                    strokeWidth={2}
                                    strokeOpacity={1}
                                    tension={0.5}
                                    lineCap="round"
                                    lineJoin="round"
                                    listening={false}
                                />
                            )}

                            {/* Custom Anchors for Line and Arrow elements */}
                            {selectedElementIds.length === 1 && elements.find(el => el.id === selectedElementIds[0] && (el.type === 'line' || el.type === 'arrow')) && (() => {
                                const element = elements.find(el => el.id === selectedElementIds[0])!;
                                const points = element.points || [0, 0, 100, 0];

                                return (
                                    <Group>
                                        {/* Start point anchor */}
                                        <Circle
                                            x={points[0]}
                                            y={points[1]}
                                            radius={8}
                                            fill="#3b82f6"
                                            stroke="#1d4ed8"
                                            strokeWidth={2}
                                            draggable={true}
                                            onDragMove={(e) => {
                                                const newPoints = [...points];
                                                newPoints[0] = e.target.x();
                                                newPoints[1] = e.target.y();
                                                updateElement(selectedElementIds[0], { points: newPoints });
                                            }}
                                        />
                                        {/* End point anchor */}
                                        <Circle
                                            x={points[2]}
                                            y={points[3]}
                                            radius={8}
                                            fill="#3b82f6"
                                            stroke="#1d4ed8"
                                            strokeWidth={2}
                                            draggable={true}
                                            onDragMove={(e) => {
                                                const newPoints = [...points];
                                                newPoints[2] = e.target.x();
                                                newPoints[3] = e.target.y();
                                                updateElement(selectedElementIds[0], { points: newPoints });
                                            }}
                                        />
                                    </Group>
                                );
                            })()}

                            {/* Selection Box Overlay */}
                            {selectionBox?.active && (() => {
                                const minX = Math.min(selectionBox.startX, selectionBox.endX);
                                const minY = Math.min(selectionBox.startY, selectionBox.endY);
                                const width = Math.abs(selectionBox.endX - selectionBox.startX);
                                const height = Math.abs(selectionBox.endY - selectionBox.startY);

                                return (
                                    <Rect
                                        x={minX}
                                        y={minY}
                                        width={width}
                                        height={height}
                                        fill="rgba(59, 130, 246, 0.1)"
                                        stroke="#3b82f6"
                                        strokeWidth={2 / scale}
                                        dash={[10 / scale, 5 / scale]}
                                        listening={false}
                                    />
                                );
                            })()}

                            {/* Transformer */}
                            <Transformer
                                ref={transformerRef}
                                boundBoxFunc={(oldBox, newBox) => {
                                    // Minimum size constraint
                                    if (newBox.width < 5 || newBox.height < 5) {
                                        return oldBox;
                                    }

                                    // Proportional resizing when Shift is held
                                    if (isShiftPressedRef.current && oldBox.width > 0 && oldBox.height > 0) {
                                        const aspectRatio = oldBox.width / oldBox.height;
                                        const newAspectRatio = newBox.width / newBox.height;

                                        // Determine which dimension changed more
                                        const widthChange = Math.abs(newBox.width - oldBox.width);
                                        const heightChange = Math.abs(newBox.height - oldBox.height);

                                        if (widthChange >= heightChange) {
                                            // Width changed more, adjust height to maintain ratio
                                            newBox.height = newBox.width / aspectRatio;
                                        } else {
                                            // Height changed more, adjust width to maintain ratio
                                            newBox.width = newBox.height * aspectRatio;
                                        }
                                    }

                                    return newBox;
                                }}
                            />
                        </Layer>
                    </Stage>

                    {/* Inline Naming Input */}
                    {namingElementId && (
                        <div
                            className="absolute z-50 transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                                left: namingPosition.x,
                                top: namingPosition.y,
                            }}
                        >
                            <div className="bg-card p-2 rounded-lg shadow-lg border border-border min-w-[200px]">
                                <p className="text-xs font-medium mb-1 text-muted-foreground">Name this element</p>
                                <div className="flex gap-2">
                                    <input
                                        ref={namingInputRef}
                                        value={namingValue}
                                        onChange={(e) => setNamingValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') finishNaming(true);
                                            if (e.key === 'Escape') finishNaming(false);
                                        }}
                                        className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Enter name..."
                                    />
                                    <Button size="sm" onClick={() => finishNaming(true)}>Save</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Text Edit Input */}
                    {editingTextId && (
                        <div
                            className="absolute z-50 transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                                left: namingPosition.x,
                                top: namingPosition.y,
                            }}
                        >
                            <div className="bg-card p-2 rounded-lg shadow-lg border border-border min-w-[300px]">
                                <p className="text-xs font-medium mb-1 text-muted-foreground">Edit text</p>
                                <div className="flex flex-col gap-2">
                                    <textarea
                                        ref={textEditInputRef}
                                        value={editingTextValue}
                                        onChange={(e) => setEditingTextValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                finishTextEdit(true);
                                            }
                                            if (e.key === 'Escape') finishTextEdit(false);
                                        }}
                                        className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                                        placeholder="Enter text..."
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => finishTextEdit(false)}>Cancel</Button>
                                        <Button size="sm" onClick={() => finishTextEdit(true)}>Save</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Properties, Layers & Links */}
                <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
                    <Tabs defaultValue="properties" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 flex-shrink-0">
                            <TabsTrigger
                                value="properties"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                Properties
                            </TabsTrigger>
                            <TabsTrigger
                                value="layers"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                Layers
                            </TabsTrigger>
                            <TabsTrigger
                                value="links"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                Links
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="properties" className="flex-1 m-0 overflow-hidden">
                            <PropertiesPanel
                                element={selectedElement}
                                onUpdateElement={updateElement}
                            />
                        </TabsContent>

                        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden">
                            <LayersPanel
                                elements={elements}
                                selectedId={selectedElementIds.length > 0 ? selectedElementIds[0] : null}
                                onSelect={(id) => setSelectedElementIds([id])}
                                onToggleVisibility={handleToggleVisibility}
                                onToggleLock={handleToggleLock}
                                onReorder={handleReorderElements}
                            />
                        </TabsContent>

                        <TabsContent value="links" className="flex-1 m-0 overflow-hidden">
                            <LinksPanel
                                element={selectedElement}
                                storeId={storeId}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default MapEditor;
