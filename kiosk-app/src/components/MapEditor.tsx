import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Trash2, ZoomIn, ZoomOut, Maximize, Grid, Eye, Send, Loader2, Monitor, Download, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, MoveHorizontal, MoveVertical, Magnet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text as KonvaText, RegularPolygon, Transformer, Image as KonvaImage, Group } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Sidebar from './map-editor/Sidebar';
import LayersPanel from './map-editor/LayersPanel';
import PropertiesPanel from './map-editor/PropertiesPanel';
import LinksPanel from './map-editor/LinksPanel';
import HistoryPanel, { type ElementHistoryEntry } from './map-editor/HistoryPanel';
import PreviewModal from './map-editor/PreviewModal';
import type { MapElement, Tool, ElementType, AnimationStyle, StrokeStyle } from './map-editor/types';
// Note: ContextualToolbar removed - properties now shown in header bar
import { defaultElement, defaultSizes, defaultSmartPin, defaultStaticPin, defaultDevicePin, CANVAS_WIDTH, CANVAS_HEIGHT, calculateFitToViewScale, animationStyleLabels, getStrokeDash, applyOpacityToColor } from './map-editor/types';
import { getGradientProps } from './map-editor/GradientEditor';
import { auth } from '@/lib/firebase';

interface MapEditorProps {
    storeId: number;
    onSave?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get auth headers for API calls
const getAuthHeaders = (): Record<string, string> => {
  const user = auth?.currentUser;
  if (!user) {
    return {};
  }
  return {
    'x-firebase-uid': user.uid,
    'x-firebase-email': user.email || '',
  };
};

const MapEditor = ({ storeId, onSave }: MapEditorProps) => {
    const [mode, setMode] = useState<'builder'>('builder');
    const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
    const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
    const [mapImagePosition, setMapImagePosition] = useState({ x: 0, y: 0 });
    const [mapImageSize, setMapImageSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    const [mapImageRotation, setMapImageRotation] = useState(0);
    const [mapImageOpacity, setMapImageOpacity] = useState(0.9);
    const [mapImageVisible, setMapImageVisible] = useState(true);
    const [isImageSelected, setIsImageSelected] = useState(false);
    const [cropModeEnabled, setCropModeEnabled] = useState(false);
    // Crop box state - defines the crop selection area relative to image
    const [cropBox, setCropBox] = useState<{
        imageId: string | 'background';
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);
    const cropBoxRef = useRef<any>(null);
    const cropBoxTransformerRef = useRef<any>(null);

    // Multiple uploaded images support with per-image eraser strokes
    const [uploadedImages, setUploadedImages] = useState<Array<{
        id: string;
        url: string;
        image: HTMLImageElement | null;
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        opacity: number;
        visible: boolean;
        eraserStrokes: number[][]; // Per-image eraser strokes
    }>>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]); // Support multi-select for images
    const [erasingImageId, setErasingImageId] = useState<string | null>(null); // Track which image is being erased

    const [elements, setElements] = useState<MapElement[]>([]);
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [tool, setTool] = useState<Tool>('select');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [autoSaving, setAutoSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track if there are unsaved changes
    const [initialLoading, setInitialLoading] = useState(true); // Track initial data loading
    const [isDrawing, setIsDrawing] = useState(false);
    const [freehandPoints, setFreehandPoints] = useState<number[]>([]);
    const [showGrid, setShowGrid] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(false); // Snap elements to grid intersections
    const [showCaptureArea, setShowCaptureArea] = useState(false); // Toggle capture area boundary visibility
    const [copiedElements, setCopiedElements] = useState<MapElement[]>([]);
    const [pasteCount, setPasteCount] = useState(0);
    const [isRightMouseDown, setIsRightMouseDown] = useState(false);
    const [isSpaceDragging, setIsSpaceDragging] = useState(false); // Track spacebar+drag panning

    // Element placement history - tracks recently placed elements with their size and color
    const [elementHistory, setElementHistory] = useState<ElementHistoryEntry[]>([]);
    const MAX_HISTORY_ENTRIES = 10; // Limit history to last 10 elements

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        visible: boolean;
        targetElementId: string | null;
        targetImageId: string | null;
        isOnCanvas: boolean;
    } | null>(null);

    // Selection box state for multi-select
    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        active: boolean;
    } | null>(null);

    // Unified history type for proper ordering of all undo/redo actions
    type UploadedImageData = { id: string; url: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; visible: boolean; eraserStrokes: number[][] };
    type HistoryAction =
        | { type: 'elements'; elements: MapElement[] }
        | { type: 'uploadedImageEraser'; imageId: string; previousStrokes: number[][]; addedStroke: number[] }
        | { type: 'legacyEraser'; previousStrokes: number[][]; addedStroke: number[] }
        | { type: 'uploadedImages'; previousImages: UploadedImageData[]; afterImages: UploadedImageData[] };

    // Unified history state for undo/redo (replaces separate histories)
    const [unifiedHistory, setUnifiedHistory] = useState<HistoryAction[]>([{ type: 'elements', elements: [] }]);
    const [unifiedHistoryStep, setUnifiedHistoryStep] = useState(0);

    // Zoom state - default to 0.56 which represents "100%" visually (fits capture area)
    const [scale, setScale] = useState(0.56);
    const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
    const [hasInitializedPosition, setHasInitializedPosition] = useState(false);

    // Inline naming state (replaces dialog)
    const [namingElementId, setNamingElementId] = useState<string | null>(null);
    const [namingValue, setNamingValue] = useState('');
    const [namingPosition, setNamingPosition] = useState({ x: 0, y: 0 });

    // Text editing state
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState('');

    // Label editing state (for element labels - pin labels, shape labels, etc.)
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editingLabelValue, setEditingLabelValue] = useState('');
    const [editingLabelPosition, setEditingLabelPosition] = useState({ x: 0, y: 0 });

    // Preview and Publish state
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [publishStatus, setPublishStatus] = useState<{
        lastPublishedAt: string | null;
        hasDraftChanges: boolean;
        unpublishedElementCount: number;
    } | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [lastPublishedElements, setLastPublishedElements] = useState<string>(''); // Track last published state for local comparison
    const [lastPublishedEraserStrokes, setLastPublishedEraserStrokes] = useState<string>(''); // Track last published eraser strokes
    const [lastPublishedImages, setLastPublishedImages] = useState<string>(''); // Track last published uploaded images
    const [hasLinkChanges, setHasLinkChanges] = useState(false); // Track if product links have changed since last publish

    // Contextual toolbar position
    const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);

    // Animation preview state - tracks which pin to animate and trigger count
    const [animationPreview, setAnimationPreview] = useState<{ pinId: string; style: number; trigger: number } | null>(null);

    // Smart guides state for alignment
    const [smartGuides, setSmartGuides] = useState<{
        vertical: number[];   // X positions of vertical lines
        horizontal: number[]; // Y positions of horizontal lines
    }>({ vertical: [], horizontal: [] });

    // Eraser state
    const [eraserSize, setEraserSize] = useState(20);
    const [eraserStrokes, setEraserStrokes] = useState<number[][]>([]); // Array of point arrays (legacy mapImage)
    const [currentEraserStroke, setCurrentEraserStroke] = useState<number[]>([]);
    const [isErasing, setIsErasing] = useState(false);
    const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
    // Note: Eraser history is now handled by unifiedHistory above

    const transformerRef = useRef<any>(null);
    const imageTransformerRef = useRef<any>(null);
    const uploadedImageTransformerRef = useRef<any>(null);
    const mapImageRef = useRef<any>(null);
    const imageGroupRef = useRef<any>(null);
    const stageRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elementsRef = useRef(elements);
    const selectedElementIdsRef = useRef(selectedElementIds);
    const namingInputRef = useRef<HTMLInputElement>(null);
    const textEditInputRef = useRef<HTMLTextAreaElement>(null);
    const labelEditInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isUndoRedoRef = useRef(false); // Track if we're in undo/redo
    const isShiftPressedRef = useRef(false); // Track Shift key for proportional resizing
    const isCtrlCmdPressedRef = useRef(false); // Track Ctrl/Cmd key to disable smart guides
    const isSpacePressedRef = useRef(false); // Track Spacebar for pan mode
    const eraserSizeRef = useRef(eraserSize); // Track eraser size for callbacks
    const mapImagePositionRef = useRef(mapImagePosition); // Track image position for eraser
    const eraserStrokesRef = useRef(eraserStrokes); // Track eraser strokes for undo
    const uploadedImagesRef = useRef(uploadedImages); // Track uploaded images for eraser
    const erasingImageIdRef = useRef(erasingImageId); // Track which image is being erased
    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map()); // Track drag start positions
    const lineArrowDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // Track drag offset for line/arrow anchors
    const initialLoadRef = useRef(true); // Track initial load to detect changes
    const lastSavedStateRef = useRef<string | null>(null); // Track last saved state for comparison
    const justFinishedEditingRef = useRef(false); // Prevent double-click right after dismissing prompt
    const unifiedHistoryRef = useRef(unifiedHistory); // Track unified history for callbacks
    const unifiedHistoryStepRef = useRef(unifiedHistoryStep); // Track history step for callbacks
    const imageDragStartStateRef = useRef<typeof uploadedImages | null>(null); // Track image state before drag/transform for undo

    // Keep refs in sync with state
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        selectedElementIdsRef.current = selectedElementIds;
    }, [selectedElementIds]);

    useEffect(() => {
        eraserSizeRef.current = eraserSize;
    }, [eraserSize]);

    useEffect(() => {
        mapImagePositionRef.current = mapImagePosition;
    }, [mapImagePosition]);

    useEffect(() => {
        eraserStrokesRef.current = eraserStrokes;
    }, [eraserStrokes]);

    useEffect(() => {
        uploadedImagesRef.current = uploadedImages;
    }, [uploadedImages]);

    // Save uploadedImages to localStorage (for persistence across page reloads)
    useEffect(() => {
        if (uploadedImages.length > 0) {
            // Save only serializable data (exclude HTMLImageElement)
            const dataToSave = uploadedImages.map(img => ({
                id: img.id,
                url: img.url,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                eraserStrokes: img.eraserStrokes,
            }));
            localStorage.setItem(`map-editor-images-${storeId}`, JSON.stringify(dataToSave));
        } else {
            // Clear localStorage if no images
            localStorage.removeItem(`map-editor-images-${storeId}`);
        }
    }, [uploadedImages, storeId]);

    useEffect(() => {
        erasingImageIdRef.current = erasingImageId;
    }, [erasingImageId]);

    useEffect(() => {
        unifiedHistoryRef.current = unifiedHistory;
    }, [unifiedHistory]);

    useEffect(() => {
        unifiedHistoryStepRef.current = unifiedHistoryStep;
    }, [unifiedHistoryStep]);

    // Cache the image group when eraser strokes change (needed for composite operations)
    useEffect(() => {
        if (imageGroupRef.current && mapImage) {
            // Clear cache first, then re-cache
            imageGroupRef.current.clearCache();
            imageGroupRef.current.cache();
        }
    }, [eraserStrokes, currentEraserStroke, mapImage, mapImageSize]);

    // Cache uploaded image groups when their eraser strokes change
    useEffect(() => {
        if (stageRef.current) {
            // Use requestAnimationFrame to ensure DOM is updated first
            requestAnimationFrame(() => {
                uploadedImages.forEach(img => {
                    const groupNode = stageRef.current?.findOne(`#image-group-${img.id}`);
                    if (groupNode && img.image) {
                        groupNode.clearCache();
                        groupNode.cache();
                        groupNode.getLayer()?.batchDraw();
                    }
                });
            });
        }
    }, [uploadedImages, currentEraserStroke, isErasing]);

    // Update contextual toolbar position when selection changes
    useEffect(() => {
        if (selectedElementIds.length === 1) {
            const element = elements.find(el => el.id === selectedElementIds[0]);
            if (element) {
                // Calculate center-top position of element
                let x = element.x;
                let y = element.y;

                // For lines and arrows, calculate position from points array
                if (element.type === 'line' || element.type === 'arrow') {
                    const points = element.points || [0, 0, 100, 0];
                    // Calculate center X of the line
                    x = (points[0] + points[2]) / 2;
                    // Use the topmost Y point
                    y = Math.min(points[1], points[3]);
                } else if (element.type === 'smart-pin') {
                    // Smart pins extend above their Y position (teardrop shape)
                    const pinSize = Math.max(element.width, element.height) * 1.2;
                    const pinRadius = pinSize * 0.4;
                    y = element.y - pinRadius - pinRadius * 0.2 - pinRadius; // Top of the pin circle
                } else if (element.type === 'static-pin') {
                    // Static pins extend above their Y position (cornered square badge)
                    const staticPinHeight = (element.height || 55) * 0.7;
                    const staticPointerHeight = (element.height || 55) * 0.3;
                    y = element.y - staticPinHeight - staticPointerHeight; // Top of the rectangle
                } else if (element.type === 'device-pin') {
                    // Device pins extend above their Y position (screen + stand)
                    const devicePinHeight = element.height || 60;
                    const screenHeight = devicePinHeight * 0.70;
                    const standHeight = devicePinHeight * 0.30;
                    y = element.y - screenHeight - standHeight; // Top of the screen
                } else if (element.type !== 'circle' && element.type !== 'polygon' && element.type !== 'triangle') {
                    // For most elements, use center-top position
                    x = element.x + element.width / 2;
                }

                setToolbarPosition({ x, y });
            }
        } else {
            setToolbarPosition(null);
        }
    }, [selectedElementIds, elements]);

    // Animation preview effect - plays a demo animation when animation style is changed on a pin
    useEffect(() => {
        if (!animationPreview || !stageRef.current || animationPreview.style === 0) return;

        const stage = stageRef.current;
        const node = stage.findOne(`#${animationPreview.pinId}`);
        if (!node) return;

        // Get animation config based on style
        const getAnimConfig = (style: number) => {
            switch (style) {
                case 1: // Pulse
                    return { duration: 0.6, props: { scaleX: 1.15, scaleY: 1.15, opacity: 0.8 }, easing: Konva.Easings.EaseInOut };
                case 2: // Bounce
                    return { duration: 0.5, props: { y: node.y() - 10 }, easing: Konva.Easings.BounceEaseOut };
                case 3: // Ripple
                    return { duration: 1, props: { opacity: 0.5 }, easing: Konva.Easings.EaseOut };
                case 4: // Flash
                    return { duration: 0.3, props: { opacity: 0.3 }, easing: Konva.Easings.Linear };
                case 5: // Glow
                    return { duration: 0.8, props: { scaleX: 1.08, scaleY: 1.08 }, easing: Konva.Easings.EaseInOut };
                default:
                    return null;
            }
        };

        const config = getAnimConfig(animationPreview.style);
        if (!config) return;

        // Store original values
        const originalProps = {
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            opacity: node.opacity(),
            y: node.y(),
        };

        // Create forward animation
        const forwardTween = new Konva.Tween({
            node,
            duration: config.duration,
            easing: config.easing,
            ...config.props,
            onFinish: () => {
                // Create reverse animation back to original
                const reverseTween = new Konva.Tween({
                    node,
                    duration: config.duration,
                    easing: config.easing,
                    scaleX: originalProps.scaleX,
                    scaleY: originalProps.scaleY,
                    opacity: originalProps.opacity,
                    y: originalProps.y,
                });
                reverseTween.play();
            },
        });
        forwardTween.play();
    }, [animationPreview]);

    // Load map image
    const [loadedImage] = useImage(mapImageUrl ? `${API_URL}${mapImageUrl}` : '');

    useEffect(() => {
        loadMapData();
        fetchPublishStatus();
    }, [storeId]);

    useEffect(() => {
        if (loadedImage) {
            setMapImage(loadedImage);
        }
    }, [loadedImage]);

    // Fetch publish status
    const fetchPublishStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map/status`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setPublishStatus(data);
            }
        } catch (error) {
            console.error('Error fetching publish status:', error);
        }
    }, [storeId]);

    // Handle publish
    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            // First, save uploaded images to database (draft)
            const imagesToSave = uploadedImages.map(img => ({
                id: img.id,
                url: img.url,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                eraserStrokes: img.eraserStrokes
            }));

            const saveImagesResponse = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/uploaded-images`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ uploadedImages: imagesToSave })
                }
            );

            if (!saveImagesResponse.ok) {
                console.error('Failed to save images to database');
            }

            // Publish elements
            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/publish`,
                { method: 'POST', headers: getAuthHeaders() }
            );

            if (response.ok) {
                // Also publish uploaded images
                await fetch(
                    `${API_URL}/api/admin/stores/${storeId}/map/uploaded-images/publish`,
                    { method: 'POST', headers: getAuthHeaders() }
                );

                const data = await response.json();
                toast.success(`Map published successfully! ${data.publishedCount} elements are now live.`);
                // Store current state as the new published state for local comparison
                const publishedState = JSON.stringify(elements.map(el => ({
                    id: el.id, type: el.type, name: el.name, x: el.x, y: el.y, width: el.width, height: el.height,
                    fillColor: el.fillColor, strokeColor: el.strokeColor, fillOpacity: el.fillOpacity,
                    strokeWidth: el.strokeWidth, cornerRadius: el.cornerRadius,
                    rotation: el.rotation, text: el.text, zIndex: el.zIndex, visible: el.visible,
                    animationStyle: el.animationStyle, motionScale: el.motionScale, pinLabel: el.pinLabel,
                    pinLabelFontSize: el.pinLabelFontSize, pinLabelColor: el.pinLabelColor, pinLabelFontWeight: el.pinLabelFontWeight,
                    fontSize: el.fontSize, fontWeight: el.fontWeight
                })));
                setLastPublishedElements(publishedState);
                // Save uploaded images state as published (including position, size, eraser strokes)
                setLastPublishedImages(JSON.stringify(uploadedImages.map(img => ({
                    id: img.id,
                    x: img.x,
                    y: img.y,
                    width: img.width,
                    height: img.height,
                    eraserStrokes: img.eraserStrokes
                }))));
                // Reset link changes flag after successful publish
                setHasLinkChanges(false);

                // Also update localStorage for backward compatibility
                localStorage.setItem(`map-editor-images-${storeId}`, JSON.stringify(imagesToSave));

                fetchPublishStatus();
            } else {
                const error = await response.json();
                toast.error(`Failed to publish: ${error.error}`);
            }
        } catch (error) {
            toast.error('Failed to publish map. Please try again.');
        } finally {
            setIsPublishing(false);
        }
    };

    // Mark that there are draft changes (optimistic update for UI)
    const markDraftChanges = useCallback(() => {
        setPublishStatus(prev => {
            if (!prev) {
                return {
                    lastPublishedAt: null,
                    hasDraftChanges: true,
                    unpublishedElementCount: 1
                };
            }
            return {
                ...prev,
                hasDraftChanges: true,
                unpublishedElementCount: prev.unpublishedElementCount + 1
            };
        });
    }, []);

    // Check if there are local draft changes by comparing current elements to last published state
    const hasLocalDraftChanges = useCallback(() => {
        // Check if product links have changed
        if (hasLinkChanges) return true;

        // Check if elements have changed
        if (lastPublishedElements === '') {
            if (elements.length > 0) return true; // No published state yet, any elements means changes
        }
        const currentState = JSON.stringify(elements.map(el => ({
            id: el.id, type: el.type, name: el.name, x: el.x, y: el.y, width: el.width, height: el.height,
            fillColor: el.fillColor, strokeColor: el.strokeColor, fillOpacity: el.fillOpacity,
            strokeWidth: el.strokeWidth, cornerRadius: el.cornerRadius,
            rotation: el.rotation, text: el.text, zIndex: el.zIndex, visible: el.visible,
            animationStyle: el.animationStyle, motionScale: el.motionScale, pinLabel: el.pinLabel,
            pinLabelFontSize: el.pinLabelFontSize, pinLabelColor: el.pinLabelColor, pinLabelFontWeight: el.pinLabelFontWeight,
            fontSize: el.fontSize, fontWeight: el.fontWeight
        })));

        // Check if uploaded images have changed (position, size, eraser strokes)
        const currentImagesState = JSON.stringify(uploadedImages.map(img => ({
            id: img.id,
            x: img.x,
            y: img.y,
            width: img.width,
            height: img.height,
            eraserStrokes: img.eraserStrokes
        })));

        return currentState !== lastPublishedElements || currentImagesState !== lastPublishedImages;
    }, [elements, lastPublishedElements, uploadedImages, lastPublishedImages, hasLinkChanges]);

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

    // Center the canvas on initial load (after container is rendered)
    useEffect(() => {
        if (!hasInitializedPosition && canvasContainerRef.current) {
            const containerWidth = canvasContainerRef.current.offsetWidth;
            const containerHeight = canvasContainerRef.current.offsetHeight;

            // Only initialize if container has dimensions
            if (containerWidth > 0 && containerHeight > 0) {
                const scaledCanvasWidth = CANVAS_WIDTH * scale;
                const scaledCanvasHeight = CANVAS_HEIGHT * scale;

                const centerX = (containerWidth - scaledCanvasWidth) / 2;
                const centerY = (containerHeight - scaledCanvasHeight) / 2;

                // Only set position if it hasn't been loaded from localStorage
                const saved = localStorage.getItem(`map-editor-canvas-state-${storeId}`);
                if (!saved || !JSON.parse(saved).stagePosition) {
                    setStagePosition({ x: centerX, y: centerY });
                }
                setHasInitializedPosition(true);
            }
        }
    }, [hasInitializedPosition, scale, storeId]);

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

    // Focus label edit input when it appears
    useEffect(() => {
        if (editingLabelId && labelEditInputRef.current) {
            setTimeout(() => {
                labelEditInputRef.current?.focus();
                labelEditInputRef.current?.select();
            }, 50);
        }
    }, [editingLabelId]);

    // Update label edit position when zoom/pan changes (to keep cursor centered on element)
    useEffect(() => {
        if (editingLabelId) {
            const element = elements.find(el => el.id === editingLabelId);
            if (element) {
                setEditingLabelPosition(getElementCenter(element));
            }
        }
        // Also update text editing position
        if (editingTextId) {
            const element = elements.find(el => el.id === editingTextId);
            if (element) {
                setEditingLabelPosition(getElementCenter(element));
            }
        }
    }, [scale, stagePosition.x, stagePosition.y, editingLabelId, editingTextId]);

    // Track Shift key for proportional resizing and Ctrl/Cmd key to disable smart guides
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = true;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                isCtrlCmdPressedRef.current = true;
            }
            if (e.key === ' ' || e.code === 'Space') {
                // Prevent page scroll when spacebar is pressed (unless in input)
                if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                    e.preventDefault();
                }
                isSpacePressedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = false;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                isCtrlCmdPressedRef.current = false;
            }
            if (e.key === ' ' || e.code === 'Space') {
                isSpacePressedRef.current = false;
                setIsSpaceDragging(false);
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
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
            // Clear unsaved changes flag and update saved state reference
            setHasUnsavedChanges(false);
            lastSavedStateRef.current = JSON.stringify(elementsToSave.map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height })));
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

    // Helper to convert element coordinates from canvas to percentage
    const convertToPercentage = useCallback((element: MapElement) => ({
        ...element,
        x: (element.x / CANVAS_WIDTH) * 100,
        y: (element.y / CANVAS_HEIGHT) * 100,
        width: (element.width / CANVAS_WIDTH) * 100,
        height: (element.height / CANVAS_HEIGHT) * 100,
    }), []);

    // Create a single element in the database (INSERT)
    const createElementInDb = useCallback(async (element: MapElement): Promise<{ success: boolean; dbId?: number }> => {
        try {
            const convertedElement = convertToPercentage(element);
            console.log(`[CREATE] Saving element ${element.id} to database...`);

            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/element`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ element: convertedElement })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[CREATE] Failed:', errorData.error);
                return { success: false };
            }

            const result = await response.json();
            console.log(`[CREATE] Success! Element ${element.id} -> DB ID ${result.elementId}`);
            markDraftChanges(); // Update publish status
            return { success: true, dbId: result.elementId };
        } catch (error: any) {
            console.error('[CREATE] Error:', error);
            return { success: false };
        }
    }, [storeId, convertToPercentage, markDraftChanges]);

    // Update a single element in the database (UPDATE)
    const updateElementInDb = useCallback(async (element: MapElement): Promise<boolean> => {
        try {
            // Only update elements that have database IDs (numeric IDs)
            const dbId = parseInt(element.id);
            if (isNaN(dbId)) {
                console.log(`[UPDATE] Skipping element ${element.id} - not in database yet`);
                return false;
            }

            const convertedElement = convertToPercentage(element);
            console.log(`[UPDATE] Updating element ${element.id} in database...`);

            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/element/${dbId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ element: convertedElement })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[UPDATE] Failed:', errorData.error);
                return false;
            }

            console.log(`[UPDATE] Success! Element ${element.id} updated`);
            markDraftChanges(); // Update publish status
            return true;
        } catch (error: any) {
            console.error('[UPDATE] Error:', error);
            return false;
        }
    }, [storeId, convertToPercentage, markDraftChanges]);

    // Delete a single element from the database (DELETE)
    const deleteElementFromDb = useCallback(async (elementId: string): Promise<boolean> => {
        try {
            // Only delete elements that have database IDs (numeric IDs)
            const dbId = parseInt(elementId);
            if (isNaN(dbId)) {
                console.log(`[DELETE] Skipping element ${elementId} - not in database`);
                return true; // Not an error, just wasn't persisted yet
            }

            console.log(`[DELETE] Deleting element ${elementId} from database...`);

            const response = await fetch(
                `${API_URL}/api/admin/stores/${storeId}/map/element/${dbId}`,
                {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[DELETE] Failed:', errorData.error);
                return false;
            }

            console.log(`[DELETE] Success! Element ${elementId} deleted`);
            markDraftChanges(); // Update publish status
            return true;
        } catch (error: any) {
            console.error('[DELETE] Error:', error);
            return false;
        }
    }, [storeId, markDraftChanges]);

    // Debounced update for element changes (position, size, properties)
    const pendingUpdatesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const pendingUpdateCountRef = useRef(0);

    const debouncedUpdateElement = useCallback((element: MapElement) => {
        // Clear any pending update for this element
        const existingTimeout = pendingUpdatesRef.current.get(element.id);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        } else {
            // Track pending update count
            pendingUpdateCountRef.current++;
        }

        // Schedule new update with 300ms debounce (save silently without indicator)
        const timeout = setTimeout(async () => {
            pendingUpdatesRef.current.delete(element.id);
            await updateElementInDb(element);
            pendingUpdateCountRef.current--;
        }, 300);

        pendingUpdatesRef.current.set(element.id, timeout);
    }, [updateElementInDb]);


    // Flush any pending element updates on unmount
    useEffect(() => {
        return () => {
            // Clear all pending updates on unmount (they will have already saved)
            pendingUpdatesRef.current.forEach(timeout => clearTimeout(timeout));
            pendingUpdatesRef.current.clear();
        };
    }, []);

    // Track initial load state (no longer needed for auto-save, kept for reference)
    useEffect(() => {
        if (mode === 'builder' && elements.length > 0 && initialLoadRef.current) {
            initialLoadRef.current = false;
        }
    }, [elements, mode]);

    // Update transformer
    useEffect(() => {
        if (!transformerRef.current) return;

        // Clear transformer if no selection or during editing
        if (selectedElementIds.length === 0 || namingElementId || editingTextId || editingLabelId) {
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

    // Update image transformer when image is selected (hide when crop mode is active)
    useEffect(() => {
        if (!imageTransformerRef.current || !imageGroupRef.current) return;

        // Hide transformer when crop mode is enabled to avoid overlap
        if (cropModeEnabled) {
            imageTransformerRef.current.nodes([]);
            imageTransformerRef.current.getLayer()?.batchDraw();
            return;
        }

        if (isImageSelected && mapImage) {
            imageTransformerRef.current.nodes([imageGroupRef.current]);
            imageTransformerRef.current.getLayer()?.batchDraw();
        } else {
            imageTransformerRef.current.nodes([]);
            imageTransformerRef.current.getLayer()?.batchDraw();
        }
    }, [isImageSelected, mapImage, cropModeEnabled]);

    // Update uploaded image transformer when an uploaded image is selected (hide when crop mode is active)
    useEffect(() => {
        if (!uploadedImageTransformerRef.current || !stageRef.current) return;

        // Hide transformer when crop mode is enabled to avoid overlap
        if (cropModeEnabled) {
            uploadedImageTransformerRef.current.nodes([]);
            uploadedImageTransformerRef.current.getLayer()?.batchDraw();
            return;
        }

        if (selectedImageIds.length > 0) {
            const stage = stageRef.current;
            // Find all Groups that wrap the selected images
            const nodes = selectedImageIds
                .map(id => stage.findOne(`#image-group-${id}`))
                .filter(Boolean);
            if (nodes.length > 0) {
                uploadedImageTransformerRef.current.nodes(nodes);
                uploadedImageTransformerRef.current.getLayer()?.batchDraw();
            }
        } else {
            uploadedImageTransformerRef.current.nodes([]);
            uploadedImageTransformerRef.current.getLayer()?.batchDraw();
        }
    }, [selectedImageIds, uploadedImages, cropModeEnabled]);

    // Update crop box transformer when crop mode is enabled
    useEffect(() => {
        if (!cropBoxTransformerRef.current) return;

        if (cropModeEnabled && cropBox && cropBoxRef.current) {
            cropBoxTransformerRef.current.nodes([cropBoxRef.current]);
            cropBoxTransformerRef.current.getLayer()?.batchDraw();
        } else {
            cropBoxTransformerRef.current.nodes([]);
            cropBoxTransformerRef.current.getLayer()?.batchDraw();
        }
    }, [cropModeEnabled, cropBox]);

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
            // Use refs to get the latest history state (avoids stale closure issues)
            const currentHistory = unifiedHistoryRef.current;
            const currentStep = unifiedHistoryStepRef.current;

            // Find the last elements action in unified history
            let lastElementsState = '';
            for (let i = currentStep; i >= 0; i--) {
                const action = currentHistory[i];
                if (action && action.type === 'elements') {
                    lastElementsState = JSON.stringify(action.elements);
                    break;
                }
            }

            if (currentState !== lastElementsState) {
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
        const defaultScale = 0.56; // This is "100%" - fits the capture area perfectly
        setScale(defaultScale);

        // Center the canvas in the container
        if (canvasContainerRef.current) {
            const containerWidth = canvasContainerRef.current.offsetWidth;
            const containerHeight = canvasContainerRef.current.offsetHeight;
            const scaledCanvasWidth = CANVAS_WIDTH * defaultScale;
            const scaledCanvasHeight = CANVAS_HEIGHT * defaultScale;

            const centerX = (containerWidth - scaledCanvasWidth) / 2;
            const centerY = (containerHeight - scaledCanvasHeight) / 2;

            setStagePosition({ x: centerX, y: centerY });
        } else {
            setStagePosition({ x: 0, y: 0 });
        }
    }, []);

    // Toggle capture area visibility
    const handleToggleCaptureArea = useCallback(() => {
        setShowCaptureArea(prev => !prev);
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
        setInitialLoading(true);
        try {
            // Try to load uploaded images from database first
            let imagesLoadedFromDb = false;
            try {
                const dbImagesResponse = await fetch(`${API_URL}/api/admin/stores/${storeId}/map/uploaded-images`, {
                    headers: getAuthHeaders()
                });
                if (dbImagesResponse.ok) {
                    const dbImagesData = await dbImagesResponse.json();
                    const savedImages = dbImagesData.uploadedImages;

                    if (savedImages && savedImages.length > 0) {
                        // Recreate Image objects from saved URLs
                        const loadedImages: Array<{
                            id: string;
                            url: string;
                            image: HTMLImageElement | null;
                            x: number;
                            y: number;
                            width: number;
                            height: number;
                            rotation: number;
                            opacity: number;
                            eraserStrokes: number[][];
                        }> = [];

                        for (const savedImg of savedImages) {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            // Create a promise to load the image
                            await new Promise<void>((resolve) => {
                                img.onload = () => {
                                    loadedImages.push({
                                        id: savedImg.id,
                                        url: savedImg.url,
                                        image: img,
                                        x: savedImg.x,
                                        y: savedImg.y,
                                        width: savedImg.width,
                                        height: savedImg.height,
                                        rotation: savedImg.rotation ?? 0,
                                        opacity: savedImg.opacity ?? 0.9,
                                        visible: savedImg.visible ?? true,
                                        eraserStrokes: savedImg.eraserStrokes || [],
                                    });
                                    resolve();
                                };
                                img.onerror = () => {
                                    console.warn(`Failed to load image: ${savedImg.url}`);
                                    resolve(); // Continue even if image fails to load
                                };
                                // Handle both relative and absolute URLs
                                img.src = savedImg.url.startsWith('/') ? `${API_URL}${savedImg.url}` : savedImg.url;
                            });
                        }

                        if (loadedImages.length > 0) {
                            setUploadedImages(loadedImages);
                            imagesLoadedFromDb = true;
                            // Also sync to localStorage for backup
                            localStorage.setItem(`map-editor-images-${storeId}`, JSON.stringify(savedImages));
                            // Set initial published images state for draft comparison
                            setLastPublishedImages(JSON.stringify(loadedImages.map(img => ({
                                id: img.id,
                                x: img.x,
                                y: img.y,
                                width: img.width,
                                height: img.height,
                                eraserStrokes: img.eraserStrokes
                            }))));
                        }
                    }
                }
            } catch (dbError) {
                console.warn('Failed to load images from database, falling back to localStorage:', dbError);
            }

            // Fall back to localStorage if database didn't have images
            if (!imagesLoadedFromDb) {
                const savedImagesJson = localStorage.getItem(`map-editor-images-${storeId}`);
                if (savedImagesJson) {
                    try {
                        const savedImages = JSON.parse(savedImagesJson);
                        if (savedImages && savedImages.length > 0) {
                            // Recreate Image objects from saved URLs
                            const loadedImages: Array<{
                                id: string;
                                url: string;
                                image: HTMLImageElement | null;
                                x: number;
                                y: number;
                                width: number;
                                height: number;
                                rotation: number;
                                opacity: number;
                                eraserStrokes: number[][];
                            }> = [];

                            for (const savedImg of savedImages) {
                                const img = new Image();
                                img.crossOrigin = 'anonymous';
                                // Create a promise to load the image
                                await new Promise<void>((resolve) => {
                                    img.onload = () => {
                                        loadedImages.push({
                                            id: savedImg.id,
                                            url: savedImg.url,
                                            image: img,
                                            x: savedImg.x,
                                            y: savedImg.y,
                                            width: savedImg.width,
                                            height: savedImg.height,
                                            rotation: savedImg.rotation ?? 0,
                                            opacity: savedImg.opacity ?? 0.9,
                                            visible: savedImg.visible ?? true,
                                            eraserStrokes: savedImg.eraserStrokes || [],
                                        });
                                        resolve();
                                    };
                                    img.onerror = () => {
                                        console.warn(`Failed to load image: ${savedImg.url}`);
                                        resolve(); // Continue even if image fails to load
                                    };
                                    img.src = savedImg.url.startsWith('/') ? `${API_URL}${savedImg.url}` : savedImg.url;
                                });
                            }

                            if (loadedImages.length > 0) {
                                setUploadedImages(loadedImages);
                                imagesLoadedFromDb = true; // Mark as loaded to skip legacy migration
                                // Set initial published images state for draft comparison
                                setLastPublishedImages(JSON.stringify(loadedImages.map(img => ({
                                    id: img.id,
                                    x: img.x,
                                    y: img.y,
                                    width: img.width,
                                    height: img.height,
                                    eraserStrokes: img.eraserStrokes
                                }))));
                            }
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse saved images from localStorage:', parseError);
                    }
                }
            }

            const response = await fetch(`${API_URL}/api/admin/stores/${storeId}/map`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                setMapImageUrl(null);
                setMapImage(null);
                setElements([]);
                setMode('builder');
                setInitialLoading(false);
                return;
            }
            const data = await response.json();
            const hasMap = !!data.store?.map_image_url;
            const hasElements = data.elements && data.elements.length > 0;

            // Only migrate legacy map image if we don't already have images loaded
            if (hasMap && !imagesLoadedFromDb) {
                // Migrate legacy map image to uploadedImages array
                const mapUrl = data.store.map_image_url;
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // Scale to fit canvas while maintaining aspect ratio
                    const maxSize = 800;
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;
                    if (width > maxSize || height > maxSize) {
                        const scale = Math.min(maxSize / width, maxSize / height);
                        width *= scale;
                        height *= scale;
                    }

                    // Center the image
                    const x = (CANVAS_WIDTH - width) / 2;
                    const y = (CANVAS_HEIGHT - height) / 2;

                    setUploadedImages(prev => [...prev, {
                        id: `legacy-map-${Date.now()}`,
                        url: mapUrl,
                        image: img,
                        x,
                        y,
                        width,
                        height,
                        rotation: 0,
                        opacity: 0.9,
                        visible: true,
                        eraserStrokes: [],
                    }]);
                };
                img.src = `${API_URL}${mapUrl}`;
                setMode('builder');
            } else if (hasElements || imagesLoadedFromDb) {
                // Has elements or images - go to builder
                setMode('builder');
            } else {
                // No existing work - go to builder directly
                setMode('builder');
            }

            // Clear legacy mapImage state
            setMapImageUrl(null);
            setMapImage(null);

            if (hasElements) {
                const loadedElements = data.elements.map((el: any) => {
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
                        showNameOn: metadata.showNameOn !== undefined ? metadata.showNameOn : (el.showNameOn !== undefined ? el.showNameOn : 'both'),
                        labelOffsetX: metadata.labelOffsetX ?? el.labelOffsetX ?? 0,
                        labelOffsetY: metadata.labelOffsetY ?? el.labelOffsetY ?? 0,
                        // Label styling properties
                        labelFontSize: metadata.labelFontSize ?? el.labelFontSize ?? 28,
                        labelFontFamily: metadata.labelFontFamily ?? el.labelFontFamily ?? 'Arial',
                        labelFontWeight: metadata.labelFontWeight ?? el.labelFontWeight ?? 'normal',
                        labelColor: metadata.labelColor ?? el.labelColor ?? '#000000',
                        // Pin-specific properties
                        animationStyle: metadata.animationStyle ?? el.animationStyle ?? 0,
                        motionScale: metadata.motionScale ?? el.motionScale ?? 1,
                        pinLabel: metadata.pinLabel ?? el.pinLabel ?? '',
                        pinLabelFontSize: metadata.pinLabelFontSize ?? el.pinLabelFontSize ?? 16,
                        pinLabelColor: metadata.pinLabelColor ?? el.pinLabelColor ?? '#ffffff',
                        pinLabelFontWeight: metadata.pinLabelFontWeight ?? el.pinLabelFontWeight ?? 'normal',
                        pinLabelFontFamily: metadata.pinLabelFontFamily ?? el.pinLabelFontFamily ?? 'Inter, system-ui, -apple-system, sans-serif',
                        // Transform properties
                        scaleX: metadata.scaleX ?? el.scaleX ?? 1,
                        scaleY: metadata.scaleY ?? el.scaleY ?? 1,
                        // Stroke style
                        strokeStyle: metadata.strokeStyle ?? el.strokeStyle ?? 'solid',
                        // Gradient - keep undefined if not set
                        gradient: metadata.gradient ?? el.gradient,
                        // Text effects - keep undefined if not set
                        textShadow: metadata.textShadow ?? el.textShadow,
                        textOutline: metadata.textOutline ?? el.textOutline,
                        textGlow: metadata.textGlow ?? el.textGlow,
                        // Additional text properties
                        letterSpacing: metadata.letterSpacing ?? el.letterSpacing ?? 0,
                        lineHeight: metadata.lineHeight ?? el.lineHeight ?? 1,
                        textDecoration: metadata.textDecoration ?? el.textDecoration ?? 'none',
                        // Mark as persisted since this element exists in the database
                        persisted: true,
                        metadata: metadata
                    };
                });
                setElements(loadedElements);
                // Store initial published state for local draft comparison
                const publishedState = JSON.stringify(loadedElements.map((el: MapElement) => ({
                    id: el.id, type: el.type, name: el.name, x: el.x, y: el.y, width: el.width, height: el.height,
                    fillColor: el.fillColor, strokeColor: el.strokeColor, fillOpacity: el.fillOpacity,
                    strokeWidth: el.strokeWidth, cornerRadius: el.cornerRadius,
                    rotation: el.rotation, text: el.text, zIndex: el.zIndex, visible: el.visible,
                    animationStyle: el.animationStyle, motionScale: el.motionScale, pinLabel: el.pinLabel,
                    pinLabelFontSize: el.pinLabelFontSize, pinLabelColor: el.pinLabelColor, pinLabelFontWeight: el.pinLabelFontWeight,
                    fontSize: el.fontSize, fontWeight: el.fontWeight
                })));
                setLastPublishedElements(publishedState);
            } else {
                setElements([]);
                setLastPublishedElements('');
            }
            setInitialLoading(false);
        } catch (error) {
            console.error('Error loading map:', error);
            setMapImageUrl(null);
            setMapImage(null);
            setElements([]);
            setMode('builder');
            setInitialLoading(false);
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
                { method: 'POST', body: formData, headers: getAuthHeaders() }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to upload image');
            }

            const data = await response.json();

            // Add image to canvas
            const newImageId = `img-${Date.now()}`;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // Scale image to fit reasonably on canvas (max 800px for first image, 400px for subsequent)
                const isFirstImage = uploadedImages.length === 0;
                const maxSize = isFirstImage ? 800 : 400;
                let width = img.naturalWidth;
                let height = img.naturalHeight;
                if (width > maxSize || height > maxSize) {
                    const scale = Math.min(maxSize / width, maxSize / height);
                    width *= scale;
                    height *= scale;
                }

                // Position: center for first image, offset for subsequent
                const x = isFirstImage ? (CANVAS_WIDTH - width) / 2 : 100 + (uploadedImages.length * 20);
                const y = isFirstImage ? (CANVAS_HEIGHT - height) / 2 : 100 + (uploadedImages.length * 20);

                setUploadedImages(prev => [...prev, {
                    id: newImageId,
                    url: data.imageUrl,
                    image: img,
                    x,
                    y,
                    width,
                    height,
                    rotation: 0,
                    opacity: 0.9,
                    visible: true,
                    eraserStrokes: [],
                }]);
                setSelectedImageIds([newImageId]);
                setSelectedElementIds([]);
                setIsImageSelected(false);
            };
            img.src = `${API_URL}${data.imageUrl}`;
            toast.success('Image added to canvas');
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
        } else if ((element.type === 'line' || element.type === 'arrow') && element.points && element.points.length >= 4) {
            // For line/arrow elements, calculate center from actual points
            // Points array: [x1, y1, x2, y2]
            const x1 = element.points[0];
            const y1 = element.points[1];
            const x2 = element.points[2];
            const y2 = element.points[3];
            centerX = (x1 + x2) / 2;
            centerY = (y1 + y2) / 2;
        } else if (element.type === 'static-pin') {
            // Static pin's anchor (element.x, element.y) is at the tip of the pointer (bottom)
            // The rectangle body is drawn above it, centered horizontally
            const staticPinHeight = (element.height || 55) * 0.7;
            const staticPointerHeight = (element.height || 55) * 0.3;
            centerX = element.x; // Already horizontally centered
            centerY = element.y - staticPointerHeight - (staticPinHeight / 2); // Center of the rectangle
        } else if (element.type === 'device-pin') {
            // Device pin's anchor is at the bottom of the stand base
            // The screen body is drawn above the stand
            const devicePinHeight = element.height || 60;
            const screenHeight = devicePinHeight * 0.70;
            const standHeight = devicePinHeight * 0.30;
            centerX = element.x; // Already horizontally centered
            centerY = element.y - standHeight - (screenHeight / 2); // Center of the screen
        } else if (element.type === 'smart-pin') {
            // Smart pin's anchor (element.x, element.y) is at the tip of the teardrop (bottom)
            // The circle is drawn above it
            const pinSize = Math.max(element.width, element.height) * 1.2;
            const pinRadius = pinSize * 0.4;
            centerX = element.x; // Already horizontally centered
            centerY = element.y - pinRadius - pinRadius * 0.2 - pinRadius; // Center of the circle
        } else {
            centerX = element.x + element.width / 2;
            centerY = element.y + element.height / 2;
        }

        // Apply zoom and position - don't clamp to allow input to follow element exactly
        const screenX = centerX * scale + stagePosition.x;
        const screenY = centerY * scale + stagePosition.y;

        return { x: screenX, y: screenY };
    };

    // Element history management functions
    const addToElementHistory = useCallback((element: MapElement) => {
        // Only track shape types (not pins, text, freehand)
        const trackableTypes: ElementType[] = ['rectangle', 'circle', 'triangle', 'polygon', 'trapezoid', 'parallelogram', 'line', 'arrow'];
        if (!trackableTypes.includes(element.type)) return;

        const historyEntry: ElementHistoryEntry = {
            id: element.id,
            type: element.type,
            // Size
            width: element.width,
            height: element.height,
            // Fill
            fillColor: element.fillColor,
            fillOpacity: element.fillOpacity,
            // Stroke
            strokeColor: element.strokeColor,
            strokeWidth: element.strokeWidth,
            strokeOpacity: element.strokeOpacity,
            strokeStyle: element.strokeStyle,
            // Transform
            rotation: element.rotation,
            cornerRadius: element.cornerRadius,
            // Polygon specific
            sides: element.sides,
            // Gradient
            gradient: element.gradient,
            // Timestamp
            timestamp: Date.now(),
        };

        setElementHistory(prev => {
            // Check if this element already exists in history
            const existingIndex = prev.findIndex(entry => entry.id === element.id);
            if (existingIndex >= 0) {
                // Update existing entry
                const updated = [...prev];
                updated[existingIndex] = historyEntry;
                return updated;
            }
            // Add new entry at the beginning and limit to MAX_HISTORY_ENTRIES
            return [historyEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
        });
    }, [MAX_HISTORY_ENTRIES]);

    const updateElementHistory = useCallback((id: string, updates: Partial<Omit<ElementHistoryEntry, 'id' | 'type' | 'timestamp'>>) => {
        setElementHistory(prev => prev.map(entry =>
            entry.id === id
                ? {
                    ...entry,
                    ...updates,
                    timestamp: Date.now(),
                }
                : entry
        ));
    }, []);

    const clearElementHistory = useCallback(() => {
        setElementHistory([]);
    }, []);

    const placeElementFromHistory = useCallback((entry: ElementHistoryEntry) => {
        // Get canvas center position
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;

        // Create a new element with ALL properties from the history entry
        const id = Date.now().toString();
        const newElement: MapElement = {
            // Base properties
            id,
            type: entry.type,
            name: '',
            visible: true,
            locked: false,
            zIndex: elements.length,
            showNameOn: 'both',
            // Position (will be adjusted below for some shapes)
            x: centerX - entry.width / 2,
            y: centerY - entry.height / 2,
            // Size
            width: entry.width,
            height: entry.height,
            // Fill - from history
            fillColor: entry.fillColor,
            fillOpacity: entry.fillOpacity,
            // Stroke - from history
            strokeColor: entry.strokeColor,
            strokeWidth: entry.strokeWidth,
            strokeOpacity: entry.strokeOpacity,
            strokeStyle: entry.strokeStyle,
            // Transform - from history (rotation starts at 0 for new placement)
            rotation: 0, // Don't apply rotation on placement - let user rotate if needed
            cornerRadius: entry.cornerRadius,
            // Polygon specific
            sides: entry.sides,
            // Gradient - from history
            gradient: entry.gradient,
        } as MapElement;

        // For specific shapes, adjust position calculation
        if (entry.type === 'circle' || entry.type === 'polygon' || entry.type === 'triangle') {
            newElement.x = centerX;
            newElement.y = centerY;
        }

        // Add element to state
        setElements(prev => [...prev, newElement]);
        setSelectedElementIds([id]);

        // Add to history (update with new ID)
        addToElementHistory(newElement);

        // Auto-switch to select mode
        setTool('select');

        // Save to database
        (async () => {
            const result = await createElementInDb(newElement);
            if (result.success && result.dbId) {
                const newDbId = result.dbId.toString();
                setElements(prev => prev.map(el =>
                    el.id === id
                        ? { ...el, id: newDbId, persisted: true, metadata: { ...el.metadata, frontendId: id } }
                        : el
                ));
                setSelectedElementIds(prev => prev.map(prevId => prevId === id ? newDbId : prevId));
                // Update history entry with new DB ID
                setElementHistory(prev => prev.map(historyEntry =>
                    historyEntry.id === id ? { ...historyEntry, id: newDbId } : historyEntry
                ));
            }
        })();

        toast.success(`Placed ${entry.type} from history`);
    }, [elements.length, addToElementHistory]);

    const createElement = (type: ElementType, x: number, y: number) => {
        const id = Date.now().toString();
        const size = defaultSizes[type] || { width: 100, height: 100 };

        let newElement: MapElement | null = null;

        switch (type) {
            case 'rectangle':
                newElement = {
                    id,
                    type: 'rectangle',
                    name: '', // Start with empty name - user types it via prompt
                    x: x - size.width / 2,  // Center at click position
                    y: y - size.height / 2, // Center at click position
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'circle':
                newElement = {
                    id,
                    type: 'circle',
                    name: '',
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
                    name: '',
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
                    name: '',
                    x: x - size.width / 2,  // Center at click position
                    y: y - size.height / 2, // Center at click position
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'parallelogram':
                newElement = {
                    id,
                    type: 'parallelogram',
                    name: '',
                    x: x - size.width / 2,  // Center at click position
                    y: y - size.height / 2, // Center at click position
                    width: size.width,
                    height: size.height,
                    ...defaultElement,
                } as MapElement;
                break;
            case 'line':
                newElement = {
                    id,
                    type: 'line',
                    name: '',
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    points: [x - 50, y, x + 50, y],
                    ...defaultElement,
                    strokeWidth: 6, // Override default for lines
                } as MapElement;
                break;
            case 'arrow':
                newElement = {
                    id,
                    type: 'arrow',
                    name: '',
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    points: [x - 50, y, x + 50, y],
                    ...defaultElement,
                    strokeWidth: 6, // Override default for arrows
                } as MapElement;
                break;
            case 'polygon':
                newElement = {
                    id,
                    type: 'polygon',
                    name: '',
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
                    name: '',
                    x: x - 100,
                    y: y - 20,
                    width: 200,
                    height: 40,
                    text: 'Double-click to edit',
                    ...defaultElement,
                } as MapElement;
                break;
            case 'smart-pin':
                // Calculate offset to center pin visually on the click position
                // The pin's anchor is at the bottom tip, but we want the visual center (the circle) at the click position
                const smartPinSize = Math.max(size.width, size.height) * 1.2;
                const smartPinRadius = smartPinSize * 0.4;
                const smartPinVisualCenterOffset = smartPinRadius + smartPinRadius * 0.2 + smartPinRadius; // Distance from anchor to circle center
                newElement = {
                    id,
                    type: 'smart-pin',
                    name: '',
                    x: x, // Anchor point (bottom of pin V)
                    y: y + smartPinVisualCenterOffset, // Offset anchor so visual center is at click position
                    width: size.width,
                    height: size.height,
                    ...defaultSmartPin,
                } as MapElement;
                break;
            case 'static-pin':
                // Calculate offset to center pin visually on the click position
                // The pin's anchor is at the bottom tip, but we want the visual center (the rectangle) at the click position
                const staticPinHeight = (size.height || 55) * 0.7;
                const staticPointerHeight = (size.height || 55) * 0.3;
                const staticPinVisualCenterOffset = staticPointerHeight + staticPinHeight / 2; // Distance from anchor to rectangle center
                newElement = {
                    id,
                    type: 'static-pin',
                    name: '',
                    x: x, // Anchor point (bottom of pin V)
                    y: y + staticPinVisualCenterOffset, // Offset anchor so visual center is at click position
                    width: size.width,
                    height: size.height,
                    ...defaultStaticPin,
                } as MapElement;
                break;
            case 'device-pin':
                // Calculate offset to center the device pin visually
                // Screen body is 70% of height, stand+pointer is 30%
                const deviceScreenHeight = (size.height || 60) * 0.55;
                const deviceStandHeight = (size.height || 60) * 0.45;
                const devicePinVisualCenterOffset = deviceStandHeight + deviceScreenHeight / 2;
                newElement = {
                    id,
                    type: 'device-pin',
                    name: '',
                    x: x,
                    y: y + devicePinVisualCenterOffset,
                    width: size.width,
                    height: size.height,
                    ...defaultDevicePin,
                } as MapElement;
                break;
        }

        if (newElement) {
            newElement.zIndex = elements.length;
            // Default to showing name on both canvas and layers panel
            if (newElement.type !== 'text') {
                newElement.showNameOn = 'both';
            }

            const tempId = newElement.id;

            // Add element to state immediately for responsive UI
            setElements(prev => [...prev, newElement!]);
            setSelectedElementIds([newElement.id]);

            // Add to element history for quick reuse
            addToElementHistory(newElement);

            // Auto-start label editing for elements (excluding smart-pin, line, arrow)
            if (newElement.type === 'text') {
                // For text elements, use inline cursor editing (same as other elements)
                const center = getElementCenter(newElement);
                setEditingLabelPosition(center);
                setEditingLabelValue(''); // Start with empty - user types to replace default text
                setEditingLabelId(newElement.id);
            } else if (newElement.type === 'static-pin' || newElement.type === 'device-pin') {
                // For static pins and device pins, edit pinLabel
                const center = getElementCenter(newElement);
                setEditingLabelPosition(center);
                setEditingLabelValue('');
                setEditingLabelId(newElement.id);
            } else if (newElement.type !== 'smart-pin' && newElement.type !== 'line' && newElement.type !== 'arrow' && newElement.type !== 'freehand') {
                // For other shapes, edit text label
                const center = getElementCenter(newElement);
                setEditingLabelPosition(center);
                setEditingLabelValue('');
                setEditingLabelId(newElement.id);
            }

            // Auto-switch to select mode
            setTool('select');

            // Immediately save to database and update element ID
            (async () => {
                const result = await createElementInDb(newElement);
                if (result.success && result.dbId) {
                    const newDbId = result.dbId!.toString();
                    // Update the element's ID to the database ID and mark as persisted
                    setElements(prev => prev.map(el =>
                        el.id === tempId
                            ? { ...el, id: newDbId, persisted: true, metadata: { ...el.metadata, frontendId: tempId } }
                            : el
                    ));
                    // Update selection to use new ID
                    setSelectedElementIds(prev => prev.map(id =>
                        id === tempId ? newDbId : id
                    ));
                    // Update editingLabelId if it was set to the temp ID
                    setEditingLabelId(prev => prev === tempId ? newDbId : prev);
                    // Update editingTextId if it was set to the temp ID
                    setEditingTextId(prev => prev === tempId ? newDbId : prev);
                    // Update element history with new db ID
                    setElementHistory(prev => prev.map(entry =>
                        entry.id === tempId ? { ...entry, id: newDbId } : entry
                    ));
                }
            })();
        }
    };

    // Helper function to calculate canvas coordinates from a Konva event
    // Uses the Layer's getRelativePointerPosition which handles all transforms correctly
    const getCanvasPositionFromKonvaEvent = (e: any): { x: number; y: number } | null => {
        const stage = e.target.getStage();
        if (!stage) return null;

        // Get the first layer and use its getRelativePointerPosition
        // This properly accounts for stage position and scale transforms
        const layer = stage.getLayers()[0];
        if (layer) {
            const pos = layer.getRelativePointerPosition();
            if (pos) return pos;
        }

        // Fallback: use stage's getRelativePointerPosition
        return stage.getRelativePointerPosition();
    };

    // Helper for non-Konva events (like React DragEvent)
    // Manually calculates canvas coordinates to handle React synthetic events correctly
    const getCanvasPositionFromDragEvent = (e: React.DragEvent): { x: number; y: number } | null => {
        const stage = stageRef.current;
        if (!stage) return null;

        // Get the stage's content element (the Konva container)
        const stageContent = stage.content;
        if (!stageContent) return null;

        // Get the bounding rect of the stage's content element
        const rect = stageContent.getBoundingClientRect();

        // Calculate position relative to the stage's content element
        // Use nativeEvent to ensure we get accurate coordinates
        const nativeEvent = e.nativeEvent;
        const pointerX = nativeEvent.clientX - rect.left;
        const pointerY = nativeEvent.clientY - rect.top;

        // Apply inverse transforms to get canvas coordinates
        // Formula: canvasPos = (pointerPos - stagePosition) / scale
        const canvasX = (pointerX - stagePosition.x) / scale;
        const canvasY = (pointerY - stagePosition.y) / scale;

        return { x: canvasX, y: canvasY };
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const toolType = e.dataTransfer.getData('toolType') as ElementType;
        if (!toolType) return;

        const pos = getCanvasPositionFromDragEvent(e);
        if (!pos) return;

        createElement(toolType, pos.x, pos.y);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Helper function to find which uploaded image is under the cursor
    const findImageAtPosition = (x: number, y: number): string | null => {
        // Check uploaded images in reverse order (top-most first)
        for (let i = uploadedImagesRef.current.length - 1; i >= 0; i--) {
            const img = uploadedImagesRef.current[i];
            if (img.image &&
                x >= img.x && x <= img.x + img.width &&
                y >= img.y && y <= img.y + img.height) {
                return img.id;
            }
        }
        // Also check legacy mapImage if it exists
        if (mapImage) {
            const imgX = mapImagePositionRef.current.x;
            const imgY = mapImagePositionRef.current.y;
            if (x >= imgX && x <= imgX + mapImageSize.width &&
                y >= imgY && y <= imgY + mapImageSize.height) {
                return '__legacy_map_image__';
            }
        }
        return null;
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

        // If we're editing a label, finish editing first
        if (editingLabelId) {
            finishLabelEdit(true);
            return;
        }

        // In crop mode, don't clear selections - user should interact with crop box only
        if (cropModeEnabled) {
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

        // Use Layer's getRelativePointerPosition for accurate canvas coordinates
        const pos = getCanvasPositionFromKonvaEvent(e);
        if (!pos) return;

        // For freehand, start drawing
        if (tool === 'freehand') {
            setIsDrawing(true);
            setFreehandPoints([pos.x, pos.y]);
            return;
        }

        // For other tools, create element
        createElement(tool as ElementType, pos.x, pos.y);
    };

    const handleStageMouseMove = (e: any) => {
        // Handle freehand drawing
        if (isDrawing && tool === 'freehand') {
            const pos = getCanvasPositionFromKonvaEvent(e);
            if (!pos) return;
            setFreehandPoints(prev => [...prev, pos.x, pos.y]);
            return;
        }

        // Handle eraser drawing (store positions relative to image)
        if (isErasing && tool === 'eraser' && erasingImageIdRef.current) {
            const pos = getCanvasPositionFromKonvaEvent(e);
            if (!pos) return;

            // Get the image being erased
            if (erasingImageIdRef.current === '__legacy_map_image__') {
                // Legacy mapImage
                const relX = pos.x - mapImagePositionRef.current.x;
                const relY = pos.y - mapImagePositionRef.current.y;
                setCurrentEraserStroke(prev => [...prev, relX, relY]);
            } else {
                // Uploaded image
                const img = uploadedImagesRef.current.find(i => i.id === erasingImageIdRef.current);
                if (img) {
                    const relX = pos.x - img.x;
                    const relY = pos.y - img.y;
                    setCurrentEraserStroke(prev => [...prev, relX, relY]);
                }
            }
        }
    };

    const handleStageMouseUp = () => {
        // Handle freehand drawing completion
        if (isDrawing && tool === 'freehand') {
            if (freehandPoints.length > 4) {
                const tempId = Date.now().toString();
                const newElement: MapElement = {
                    id: tempId,
                    type: 'freehand',
                    name: 'Freehand',
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    freehandPoints: [...freehandPoints],
                    zIndex: elements.length,
                    showNameOn: 'both',
                    ...defaultElement,
                } as MapElement;

                setElements([...elements, newElement]);
                setSelectedElementIds([newElement.id]);

                // Immediately save to database
                (async () => {
                    const result = await createElementInDb(newElement);
                    if (result.success && result.dbId) {
                        setElements(prev => prev.map(el =>
                            el.id === tempId
                                ? { ...el, id: result.dbId!.toString(), persisted: true, metadata: { ...el.metadata, frontendId: tempId } }
                                : el
                        ));
                        setSelectedElementIds(prev => prev.map(id =>
                            id === tempId ? result.dbId!.toString() : id
                        ));
                    }
                })();
            }

            setIsDrawing(false);
            setFreehandPoints([]);
            return;
        }

        // Handle eraser stroke completion
        if (isErasing && tool === 'eraser' && erasingImageIdRef.current) {
            if (currentEraserStroke.length > 2) {
                // Add the completed stroke with the eraser size
                const newStroke = [...currentEraserStroke, eraserSizeRef.current];

                if (erasingImageIdRef.current === '__legacy_map_image__') {
                    // Legacy mapImage - use existing eraserStrokes state
                    const previousStrokes = [...eraserStrokesRef.current];
                    const newStrokes = [...previousStrokes, newStroke];
                    setEraserStrokes(newStrokes);

                    // Save to unified history for undo support
                    saveEraserToHistory(null, previousStrokes, newStroke);
                } else {
                    // Uploaded image - update the image's eraserStrokes
                    const imageId = erasingImageIdRef.current!;
                    const currentImage = uploadedImagesRef.current.find(img => img.id === imageId);
                    const previousStrokes = currentImage ? [...currentImage.eraserStrokes] : [];

                    // Save to unified history for undo support
                    saveEraserToHistory(imageId, previousStrokes, newStroke);

                    // Update the image's eraser strokes
                    setUploadedImages(prev => prev.map(img =>
                        img.id === imageId
                            ? { ...img, eraserStrokes: [...img.eraserStrokes, newStroke] }
                            : img
                    ));
                }
                setHasUnsavedChanges(true);
            }
            setIsErasing(false);
            setErasingImageId(null);
            setCurrentEraserStroke([]);
        }
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
            'device-pin': 'Device Pin',
            'group': 'Group',
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

            // Set flag to prevent double-click from re-triggering prompt
            // Flag clears after 500ms cooldown
            justFinishedEditingRef.current = true;
            setTimeout(() => {
                justFinishedEditingRef.current = false;
            }, 500);
        }
    };

    // Finish label editing
    const finishLabelEdit = (save: boolean) => {
        if (editingLabelId) {
            if (save) {
                // Update the element's property based on type:
                // - static-pin: pinLabel property
                // - text: text property
                // - other shapes: name property (shows in layers panel)
                const element = elements.find(el => el.id === editingLabelId);
                if (element) {
                    if (element.type === 'static-pin' || element.type === 'device-pin') {
                        updateElement(editingLabelId, { pinLabel: editingLabelValue.trim() });
                    } else if (element.type === 'text') {
                        // For text elements, update the text property
                        const newText = editingLabelValue.trim() || 'Text'; // Default to 'Text' if empty
                        updateElement(editingLabelId, { text: newText });
                    } else {
                        // For other shapes, update the name property so it shows in layers panel
                        updateElement(editingLabelId, { name: editingLabelValue.trim() });
                    }
                }
            }
            setEditingLabelId(null);
            setEditingLabelValue('');

            // Set flag to prevent double-click from re-triggering prompt
            // Flag clears after 500ms cooldown
            justFinishedEditingRef.current = true;
            setTimeout(() => {
                justFinishedEditingRef.current = false;
            }, 500);
        }
    };

    // Double-click to edit element label (not layer name)
    const handleElementDoubleClick = (elementId: string) => {
        // Skip if we just finished editing (prevents accidental re-trigger)
        if (justFinishedEditingRef.current) {
            return;
        }

        const element = elements.find(el => el.id === elementId);
        if (!element) return;

        // Skip label editing for smart-pin, line, and arrow
        if (element.type === 'smart-pin' || element.type === 'line' || element.type === 'arrow') {
            return;
        }

        // For text elements, use inline cursor editing (same as other elements)
        if (element.type === 'text') {
            const center = getElementCenter(element);
            setEditingLabelPosition(center);
            setEditingLabelValue(element.text || '');
            setEditingLabelId(elementId);
            return;
        }

        // For static pins and device pins, edit pinLabel
        if (element.type === 'static-pin' || element.type === 'device-pin') {
            const center = getElementCenter(element);
            setEditingLabelPosition(center);
            setEditingLabelValue(element.pinLabel || '');
            setEditingLabelId(elementId);
            return;
        }

        // For other elements (rectangle, circle, etc.), edit the name
        const center = getElementCenter(element);
        setEditingLabelPosition(center);
        setEditingLabelValue(element.name || '');
        setEditingLabelId(elementId);
    };

    // Save element state to unified history (for undo/redo)
    const saveToHistory = (newElements: MapElement[]) => {
        const action: HistoryAction = { type: 'elements', elements: JSON.parse(JSON.stringify(newElements)) };
        // Use ref to get the latest history step (avoids stale closure issues)
        const currentStep = unifiedHistoryStepRef.current;
        setUnifiedHistory(prev => {
            const newHistory = prev.slice(0, currentStep + 1);
            newHistory.push(action);
            // Limit history to 50 steps
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setUnifiedHistoryStep(prev => Math.min(prev + 1, 49));
    };

    // Save eraser stroke to unified history
    const saveEraserToHistory = (imageId: string | null, previousStrokes: number[][], addedStroke: number[]) => {
        const action: HistoryAction = imageId
            ? { type: 'uploadedImageEraser', imageId, previousStrokes, addedStroke }
            : { type: 'legacyEraser', previousStrokes, addedStroke };
        // Use ref to get the latest history step (avoids stale closure issues)
        const currentStep = unifiedHistoryStepRef.current;
        setUnifiedHistory(prev => {
            const newHistory = prev.slice(0, currentStep + 1);
            newHistory.push(action);
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setUnifiedHistoryStep(prev => Math.min(prev + 1, 49));
    };

    // Save uploaded images state to unified history (for undo/redo of image deletion)
    const saveImagesToHistory = (previousImages: UploadedImageData[], afterImages: UploadedImageData[]) => {
        const action: HistoryAction = {
            type: 'uploadedImages',
            previousImages,
            afterImages,
        };
        // Use ref to get the latest history step (avoids stale closure issues)
        const currentStep = unifiedHistoryStepRef.current;
        setUnifiedHistory(prev => {
            const newHistory = prev.slice(0, currentStep + 1);
            newHistory.push(action);
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setUnifiedHistoryStep(prev => Math.min(prev + 1, 49));
    };

    // Sync database with a new element state (for undo/redo)
    // Compares current elements with target elements and performs necessary DB operations
    const syncDatabaseWithState = useCallback(async (currentElements: MapElement[], targetElements: MapElement[]) => {
        const currentIds = new Set(currentElements.map(el => el.id));
        const targetIds = new Set(targetElements.map(el => el.id));

        // Elements to delete (in current but not in target)
        const toDelete = currentElements.filter(el => !targetIds.has(el.id));

        // Elements to create (in target but not in current)
        const toCreate = targetElements.filter(el => !currentIds.has(el.id));

        // Elements to update (in both, check if changed)
        const toUpdate = targetElements.filter(el => {
            if (!currentIds.has(el.id)) return false;
            const currentEl = currentElements.find(c => c.id === el.id);
            if (!currentEl) return false;
            // Simple deep comparison via JSON
            return JSON.stringify(el) !== JSON.stringify(currentEl);
        });

        // Perform deletions
        for (const el of toDelete) {
            await deleteElementFromDb(el.id);
        }

        // Perform creations
        for (const el of toCreate) {
            // Only create if it has a numeric ID (was previously in DB)
            // Non-numeric IDs mean it was never saved, so we need to create it
            const dbId = parseInt(el.id);
            if (isNaN(dbId)) {
                // Element was never saved to DB, create it now
                const result = await createElementInDb(el);
                if (result.success && result.dbId) {
                    // Update the element's ID in the target state and mark as persisted
                    el.id = result.dbId.toString();
                    el.persisted = true;
                    el.metadata = { ...el.metadata, frontendId: el.id };
                }
            }
            // If it has a numeric ID, it means it was deleted and we're restoring it
            // We need to re-create it in the database
            else {
                const result = await createElementInDb(el);
                if (result.success && result.dbId) {
                    // The element gets a new DB ID and mark as persisted
                    el.id = result.dbId.toString();
                    el.persisted = true;
                    el.metadata = { ...el.metadata, frontendId: el.id };
                }
            }
        }

        // Perform updates
        for (const el of toUpdate) {
            await updateElementInDb(el);
        }

        return targetElements;
    }, [deleteElementFromDb, createElementInDb, updateElementInDb]);

    // Undo - uses unified history in proper chronological order
    const handleUndo = useCallback(async () => {
        if (unifiedHistoryStep <= 0) {
            toast.error('Nothing to undo');
            return;
        }

        const currentAction = unifiedHistory[unifiedHistoryStep];
        setUnifiedHistoryStep(prev => prev - 1);

        switch (currentAction.type) {
            case 'elements':
                // Find the previous elements state
                let prevElementsAction: HistoryAction | null = null;
                for (let i = unifiedHistoryStep - 1; i >= 0; i--) {
                    if (unifiedHistory[i].type === 'elements') {
                        prevElementsAction = unifiedHistory[i];
                        break;
                    }
                }
                const targetElements = prevElementsAction && prevElementsAction.type === 'elements'
                    ? JSON.parse(JSON.stringify(prevElementsAction.elements))
                    : [];

                isUndoRedoRef.current = true;
                const currentElements = elementsRef.current;
                setSelectedElementIds([]);

                // Sync database with the target state
                const syncedElements = await syncDatabaseWithState(currentElements, targetElements);
                setElements(syncedElements);
                elementsRef.current = syncedElements;
                fetchPublishStatus();
                toast.success('Undone');
                break;

            case 'uploadedImageEraser':
                // Restore previous strokes for this image
                setUploadedImages(prev => prev.map(img =>
                    img.id === currentAction.imageId
                        ? { ...img, eraserStrokes: currentAction.previousStrokes }
                        : img
                ));
                toast.success('Eraser stroke undone');
                break;

            case 'legacyEraser':
                // Restore previous legacy eraser strokes
                setEraserStrokes(currentAction.previousStrokes);
                toast.success('Eraser stroke undone');
                break;

            case 'uploadedImages':
                // Undo: Restore the previousImages state (before the deletion/change)
                const restoredImages = currentAction.previousImages.map(imgData => {
                    // Try to find existing image with same id to reuse its HTMLImageElement
                    const existing = uploadedImages.find(img => img.id === imgData.id);
                    return {
                        ...imgData,
                        image: existing?.image || null as HTMLImageElement | null
                    };
                });

                // First set the state with null images, then load them
                setUploadedImages(restoredImages);

                // Reload any images that don't have HTMLImageElement
                restoredImages.forEach((imgData, index) => {
                    if (!imgData.image && imgData.url) {
                        const img = new window.Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            setUploadedImages(prev => {
                                const updated = [...prev];
                                if (updated[index]) {
                                    updated[index] = { ...updated[index], image: img };
                                }
                                return updated;
                            });
                        };
                        img.onerror = () => {
                            console.warn(`Failed to load restored image: ${imgData.url}`);
                        };
                        // Add API_URL prefix if URL is relative (starts with /)
                        img.src = imgData.url.startsWith('/') ? `${API_URL}${imgData.url}` : imgData.url;
                    }
                });

                toast.success('Image restored');
                break;
        }
    }, [unifiedHistoryStep, unifiedHistory, syncDatabaseWithState, fetchPublishStatus, uploadedImages]);

    // Redo - uses unified history in proper chronological order
    const handleRedo = useCallback(async () => {
        if (unifiedHistoryStep >= unifiedHistory.length - 1) {
            toast.error('Nothing to redo');
            return;
        }

        const nextStep = unifiedHistoryStep + 1;
        const nextAction = unifiedHistory[nextStep];
        setUnifiedHistoryStep(nextStep);

        switch (nextAction.type) {
            case 'elements':
                isUndoRedoRef.current = true;
                const currentElements = elementsRef.current;
                const targetElements = JSON.parse(JSON.stringify(nextAction.elements));
                setSelectedElementIds([]);

                // Sync database with the target state
                const syncedElements = await syncDatabaseWithState(currentElements, targetElements);
                setElements(syncedElements);
                elementsRef.current = syncedElements;
                fetchPublishStatus();
                toast.success('Redone');
                break;

            case 'uploadedImageEraser':
                // Re-add the stroke that was removed during undo
                setUploadedImages(prev => prev.map(img =>
                    img.id === nextAction.imageId
                        ? { ...img, eraserStrokes: [...nextAction.previousStrokes, nextAction.addedStroke] }
                        : img
                ));
                toast.success('Eraser stroke redone');
                break;

            case 'legacyEraser':
                // Re-add the stroke that was removed during undo
                setEraserStrokes([...nextAction.previousStrokes, nextAction.addedStroke]);
                toast.success('Eraser stroke redone');
                break;

            case 'uploadedImages':
                // Redo: Apply the afterImages state (after the deletion/change)
                const redoneImages = nextAction.afterImages.map(imgData => {
                    // Try to find existing image with same id to reuse its HTMLImageElement
                    const existing = uploadedImages.find(img => img.id === imgData.id);
                    return {
                        ...imgData,
                        image: existing?.image || null as HTMLImageElement | null
                    };
                });

                // First set the state
                setUploadedImages(redoneImages);

                // Reload any images that don't have HTMLImageElement
                redoneImages.forEach((imgData, index) => {
                    if (!imgData.image && imgData.url) {
                        const img = new window.Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            setUploadedImages(prev => {
                                const updated = [...prev];
                                if (updated[index]) {
                                    updated[index] = { ...updated[index], image: img };
                                }
                                return updated;
                            });
                        };
                        img.onerror = () => {
                            console.warn(`Failed to load redone image: ${imgData.url}`);
                        };
                        // Add API_URL prefix if URL is relative (starts with /)
                        img.src = imgData.url.startsWith('/') ? `${API_URL}${imgData.url}` : imgData.url;
                    }
                });

                toast.success('Image action redone');
                break;
        }
    }, [unifiedHistoryStep, unifiedHistory, syncDatabaseWithState, fetchPublishStatus, uploadedImages]);

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

                // Delete from database
                elementsToCut.forEach(el => deleteElementFromDb(el.id));
            }
        }
    }, [selectedElementIds, elements, deleteElementFromDb]);

    // Select All - includes elements and uploaded images
    const handleSelectAll = useCallback(() => {
        const visibleElementIds = elements.filter(el => el.visible).map(el => el.id);
        const uploadedImageIds = uploadedImages.map(img => img.id);

        setSelectedElementIds(visibleElementIds);
        setSelectedImageIds(uploadedImageIds);

        // Also select the main background image if it exists
        if (mapImage) {
            setIsImageSelected(true);
        }

        const totalSelected = visibleElementIds.length + uploadedImageIds.length + (mapImage ? 1 : 0);
        toast.success(`Selected ${totalSelected} item${totalSelected !== 1 ? 's' : ''}`);
    }, [elements, uploadedImages, mapImage]);

    const handleDeleteElement = useCallback((id: string) => {
        // Remove from state immediately for responsive UI
        setElements(prev => prev.filter(el => el.id !== id));
        setSelectedElementIds(prev => prev.filter(sid => sid !== id));
        toast.success('Element deleted');

        // Delete from database
        deleteElementFromDb(id);
    }, [deleteElementFromDb]);

    // Update uploaded image properties
    const handleUpdateImage = useCallback((id: string, updates: Partial<{ x: number; y: number; width: number; height: number; rotation: number; opacity: number }>) => {
        // Capture current state for history
        const previousImages = uploadedImagesRef.current.map(img => ({
            id: img.id,
            url: img.url,
            x: img.x,
            y: img.y,
            width: img.width,
            height: img.height,
            rotation: img.rotation ?? 0,
            opacity: img.opacity ?? 0.9,
            eraserStrokes: img.eraserStrokes,
        }));

        // Update the image
        setUploadedImages(prev => prev.map(img =>
            img.id === id ? { ...img, ...updates } : img
        ));

        // Save to history
        const afterImages = uploadedImagesRef.current.map(img => {
            if (img.id === id) {
                const updated = { ...img, ...updates };
                return {
                    id: updated.id,
                    url: updated.url,
                    x: updated.x,
                    y: updated.y,
                    width: updated.width,
                    height: updated.height,
                    rotation: updated.rotation ?? 0,
                    opacity: updated.opacity ?? 0.9,
                    eraserStrokes: updated.eraserStrokes,
                };
            }
            return {
                id: img.id,
                url: img.url,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                rotation: img.rotation ?? 0,
                opacity: img.opacity ?? 0.9,
                eraserStrokes: img.eraserStrokes,
            };
        });
        saveImagesToHistory(previousImages, afterImages);
        setHasUnsavedChanges(true);
    }, [saveImagesToHistory]);

    // Update background image properties
    const handleUpdateBackgroundImage = useCallback((updates: Partial<{ x: number; y: number; width: number; height: number; rotation: number; opacity: number }>) => {
        if (updates.x !== undefined || updates.y !== undefined) {
            setMapImagePosition(prev => ({
                x: updates.x ?? prev.x,
                y: updates.y ?? prev.y,
            }));
        }
        if (updates.width !== undefined || updates.height !== undefined) {
            setMapImageSize(prev => ({
                width: updates.width ?? prev.width,
                height: updates.height ?? prev.height,
            }));
        }
        if (updates.rotation !== undefined) {
            setMapImageRotation(updates.rotation);
        }
        if (updates.opacity !== undefined) {
            setMapImageOpacity(updates.opacity);
        }
        setHasUnsavedChanges(true);
    }, []);

    // Initialize crop box when entering crop mode
    const initializeCropBox = useCallback((imageId: string | 'background') => {
        if (imageId === 'background') {
            setCropBox({
                imageId: 'background',
                x: mapImagePosition.x,
                y: mapImagePosition.y,
                width: mapImageSize.width,
                height: mapImageSize.height,
            });
        } else {
            const img = uploadedImages.find(i => i.id === imageId);
            if (img) {
                setCropBox({
                    imageId,
                    x: img.x,
                    y: img.y,
                    width: img.width,
                    height: img.height,
                });
            }
        }
    }, [mapImagePosition, mapImageSize, uploadedImages]);

    // Apply crop to an image
    const handleApplyCrop = useCallback(async () => {
        if (!cropBox) return;

        const isBackground = cropBox.imageId === 'background';
        const targetImage = isBackground ? mapImage : uploadedImages.find(i => i.id === cropBox.imageId)?.image;

        if (!targetImage) {
            toast.error('No image to crop');
            return;
        }

        // Get image properties
        const imgX = isBackground ? mapImagePosition.x : (uploadedImages.find(i => i.id === cropBox.imageId)?.x ?? 0);
        const imgY = isBackground ? mapImagePosition.y : (uploadedImages.find(i => i.id === cropBox.imageId)?.y ?? 0);
        const imgWidth = isBackground ? mapImageSize.width : (uploadedImages.find(i => i.id === cropBox.imageId)?.width ?? 0);
        const imgHeight = isBackground ? mapImageSize.height : (uploadedImages.find(i => i.id === cropBox.imageId)?.height ?? 0);

        // Calculate crop region relative to original image
        const cropX = Math.max(0, cropBox.x - imgX);
        const cropY = Math.max(0, cropBox.y - imgY);
        const cropWidth = Math.min(cropBox.width, imgWidth - cropX);
        const cropHeight = Math.min(cropBox.height, imgHeight - cropY);

        // Calculate scale from displayed size to original image size
        const scaleX = targetImage.naturalWidth / imgWidth;
        const scaleY = targetImage.naturalHeight / imgHeight;

        // Create a canvas to crop the image
        const canvas = document.createElement('canvas');
        canvas.width = cropWidth * scaleX;
        canvas.height = cropHeight * scaleY;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            toast.error('Failed to create canvas for cropping');
            return;
        }

        // Draw the cropped portion
        ctx.drawImage(
            targetImage,
            cropX * scaleX,
            cropY * scaleY,
            cropWidth * scaleX,
            cropHeight * scaleY,
            0,
            0,
            cropWidth * scaleX,
            cropHeight * scaleY
        );

        // Convert to blob and upload
        canvas.toBlob(async (blob) => {
            if (!blob) {
                toast.error('Failed to create cropped image');
                return;
            }

            const formData = new FormData();
            formData.append('image', blob, 'cropped-image.png');

            try {
                const response = await fetch(
                    `${API_URL}/api/admin/stores/${storeId}/map/image`,
                    { method: 'POST', body: formData, headers: getAuthHeaders() }
                );

                if (!response.ok) {
                    throw new Error('Failed to upload cropped image');
                }

                const data = await response.json();

                // Load the new image
                const newImg = new Image();
                newImg.crossOrigin = 'anonymous';
                newImg.onload = () => {
                    if (isBackground) {
                        // Update background image
                        setMapImage(newImg);
                        setMapImageUrl(data.imageUrl);
                        setMapImagePosition({ x: cropBox.x, y: cropBox.y });
                        setMapImageSize({ width: cropWidth, height: cropHeight });
                        setMapImageRotation(0);
                    } else {
                        // Update uploaded image
                        setUploadedImages(prev => prev.map(img =>
                            img.id === cropBox.imageId
                                ? {
                                    ...img,
                                    image: newImg,
                                    url: data.imageUrl,
                                    x: cropBox.x,
                                    y: cropBox.y,
                                    width: cropWidth,
                                    height: cropHeight,
                                    rotation: 0,
                                    eraserStrokes: [],
                                }
                                : img
                        ));
                    }

                    // Clear crop box and disable crop mode
                    setCropBox(null);
                    setCropModeEnabled(false);
                    setHasUnsavedChanges(true);
                    toast.success('Image cropped successfully');
                };
                newImg.src = `${API_URL}${data.imageUrl}`;
            } catch (error) {
                console.error('Crop error:', error);
                toast.error('Failed to apply crop');
            }
        }, 'image/png');
    }, [cropBox, mapImage, mapImagePosition, mapImageSize, uploadedImages, storeId]);

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

        // Immediately save all pasted elements to database
        (async () => {
            const idMappings: { tempId: string; dbId: number }[] = [];

            for (const element of newPastedElements) {
                const result = await createElementInDb(element);
                if (result.success && result.dbId) {
                    idMappings.push({ tempId: element.id, dbId: result.dbId });
                }
            }

            // Update element IDs to database IDs and mark as persisted
            if (idMappings.length > 0) {
                setElements(prev => prev.map(el => {
                    const mapping = idMappings.find(m => m.tempId === el.id);
                    if (mapping) {
                        return { ...el, id: mapping.dbId.toString(), persisted: true, metadata: { ...el.metadata, frontendId: mapping.tempId } };
                    }
                    return el;
                }));

                // Update selection to use new IDs
                setSelectedElementIds(prev => prev.map(id => {
                    const mapping = idMappings.find(m => m.tempId === id);
                    return mapping ? mapping.dbId.toString() : id;
                }));
            }
        })();
    }, [copiedElements, elements, pasteCount, deepCloneElement, createElementInDb]);

    // Duplicate selected elements (Ctrl+D)
    const handleDuplicate = useCallback(() => {
        if (selectedElementIds.length === 0) {
            toast.error('No elements selected to duplicate');
            return;
        }

        const DUPLICATE_OFFSET = 30;
        const elementsToDuplicate = elements.filter(el => selectedElementIds.includes(el.id));
        const newDuplicatedElements: MapElement[] = [];
        const baseTimestamp = Date.now();

        elementsToDuplicate.forEach((element, index) => {
            const id = `duplicate-${baseTimestamp}-${index}-${Math.random().toString(36).substring(2, 11)}`;
            const newElement: MapElement = deepCloneElement(element);

            newElement.id = id;
            newElement.zIndex = elements.length + newDuplicatedElements.length;

            if (newElement.type === 'line' || newElement.type === 'arrow') {
                if (newElement.points) {
                    newElement.points = newElement.points.map((p, i) =>
                        i % 2 === 0 ? p + DUPLICATE_OFFSET : p + DUPLICATE_OFFSET
                    );
                }
            } else if (newElement.type === 'freehand') {
                if (newElement.freehandPoints) {
                    newElement.freehandPoints = newElement.freehandPoints.map((p, i) =>
                        i % 2 === 0 ? p + DUPLICATE_OFFSET : p + DUPLICATE_OFFSET
                    );
                }
            } else {
                newElement.x = element.x + DUPLICATE_OFFSET;
                newElement.y = element.y + DUPLICATE_OFFSET;
            }

            newDuplicatedElements.push(newElement);
        });

        setElements(prev => {
            const newElements = [...prev, ...newDuplicatedElements];
            elementsRef.current = newElements;
            return newElements;
        });

        const newSelectedIds = newDuplicatedElements.map(el => el.id);
        selectedElementIdsRef.current = newSelectedIds;
        setSelectedElementIds(newSelectedIds);

        toast.success(`Duplicated ${newDuplicatedElements.length} element${newDuplicatedElements.length > 1 ? 's' : ''}`);

        // Save to database
        (async () => {
            const idMappings: { tempId: string; dbId: number }[] = [];
            for (const element of newDuplicatedElements) {
                const result = await createElementInDb(element);
                if (result.success && result.dbId) {
                    idMappings.push({ tempId: element.id, dbId: result.dbId });
                }
            }
            if (idMappings.length > 0) {
                setElements(prev => prev.map(el => {
                    const mapping = idMappings.find(m => m.tempId === el.id);
                    if (mapping) {
                        return { ...el, id: mapping.dbId.toString(), persisted: true };
                    }
                    return el;
                }));
                setSelectedElementIds(prev => prev.map(id => {
                    const mapping = idMappings.find(m => m.tempId === id);
                    return mapping ? mapping.dbId.toString() : id;
                }));
            }
        })();
    }, [selectedElementIds, elements, deepCloneElement, createElementInDb]);

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
                    if (editingLabelId) {
                        finishLabelEdit(false);
                    }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                    if (namingElementId) {
                        e.preventDefault();
                        finishNaming(true);
                    }
                    if (editingLabelId) {
                        e.preventDefault();
                        finishLabelEdit(true);
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
                case 'd':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+D: Duplicate
                        e.preventDefault();
                        handleDuplicate();
                    }
                    break;
                case 'delete':
                case 'backspace':
                    if (!editingTextId && !namingElementId && !editingLabelId) {
                        if (selectedElementIds.length > 0) {
                            // Delete all selected elements
                            selectedElementIds.forEach(id => handleDeleteElement(id));
                        } else if (selectedImageIds.length > 0) {
                            // Delete all selected uploaded images
                            const imagesToDelete = uploadedImagesRef.current.filter(img => selectedImageIds.includes(img.id));
                            if (imagesToDelete.length > 0) {
                                // Calculate state after deletion for history
                                const previousImages = uploadedImagesRef.current;
                                const afterImages = previousImages.filter(img => !selectedImageIds.includes(img.id));

                                // Save both states to history (for undo/redo)
                                saveImagesToHistory(previousImages, afterImages);

                                // Delete from backend (for each image)
                                imagesToDelete.forEach(img => {
                                    if (img.url) {
                                        fetch(`${API_URL}/api/admin/stores/${storeId}/map/image`, { method: 'DELETE', headers: getAuthHeaders() })
                                            .catch(err => console.error('Failed to delete image from backend:', err));
                                    }
                                });
                                // Delete from state
                                setUploadedImages(afterImages);
                                setSelectedImageIds([]);
                                setHasUnsavedChanges(true);
                                toast.success(`${imagesToDelete.length} image${imagesToDelete.length > 1 ? 's' : ''} deleted`);
                            }
                        }
                    }
                    break;
                case 'escape':
                    setContextMenu(null); // Close context menu
                    // If in crop mode, cancel it but keep image selected
                    if (cropModeEnabled) {
                        setCropModeEnabled(false);
                        setCropBox(null);
                        break;
                    }
                    setSelectedElementIds([]);
                    setSelectedImageIds([]);
                    setIsImageSelected(false);
                    setEditingTextId(null);
                    setNamingElementId(null);
                    setEditingLabelId(null);
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
                case 'arrowup':
                case 'arrowdown':
                case 'arrowleft':
                case 'arrowright':
                    if (!editingTextId && !namingElementId && !editingLabelId) {
                        e.preventDefault();

                        const nudgeAmount = e.shiftKey ? 10 : 1;
                        let deltaX = 0;
                        let deltaY = 0;

                        switch (e.key.toLowerCase()) {
                            case 'arrowup': deltaY = -nudgeAmount; break;
                            case 'arrowdown': deltaY = nudgeAmount; break;
                            case 'arrowleft': deltaX = -nudgeAmount; break;
                            case 'arrowright': deltaX = nudgeAmount; break;
                        }

                        if (selectedElementIds.length > 0) {
                            const updates = new Map<string, Partial<MapElement>>();

                            selectedElementIds.forEach(id => {
                                const el = elementsRef.current.find(e => e.id === id);
                                if (!el) return;

                                if (el.type === 'line' || el.type === 'arrow') {
                                    const points = el.points || [0, 0, 100, 0];
                                    const newPoints = points.map((p, i) =>
                                        i % 2 === 0 ? p + deltaX : p + deltaY
                                    );
                                    updates.set(el.id, { points: newPoints });
                                } else if (el.type === 'freehand') {
                                    const freehandPoints = el.freehandPoints || [];
                                    const newPoints = freehandPoints.map((p, i) =>
                                        i % 2 === 0 ? p + deltaX : p + deltaY
                                    );
                                    updates.set(el.id, { freehandPoints: newPoints });
                                } else {
                                    updates.set(el.id, {
                                        x: el.x + deltaX,
                                        y: el.y + deltaY,
                                    });
                                }
                            });

                            updateMultipleElements(updates);
                        } else if (selectedImageIds.length > 0) {
                            // Nudge selected images
                            setUploadedImages(prev => prev.map(img => {
                                if (selectedImageIds.includes(img.id)) {
                                    return {
                                        ...img,
                                        x: img.x + deltaX,
                                        y: img.y + deltaY,
                                    };
                                }
                                return img;
                            }));
                            setHasUnsavedChanges(true);
                        }
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
        editingLabelId,
        handleUndo,
        handleRedo,
        handleCopy,
        handlePaste,
        handleCut,
        handleDuplicate,
        handleSelectAll,
        handleDeleteElement,
        handleZoomIn,
        handleZoomOut,
        handleResetZoom,
        storeId,
        selectedImageIds,
    ]);

    const updateElement = (id: string, updates: Partial<MapElement>) => {
        // Check if this is an animation style change for a pin - trigger preview
        if (updates.animationStyle !== undefined) {
            const element = elementsRef.current.find(el => el.id === id);
            if (element && (element.type === 'smart-pin' || element.type === 'static-pin' || element.type === 'device-pin')) {
                // Only preview if animation is not 0 (Set animation)
                if (updates.animationStyle !== 0) {
                    setAnimationPreview(prev => ({
                        pinId: id,
                        style: updates.animationStyle as number,
                        trigger: (prev?.trigger || 0) + 1
                    }));
                }
            }
        }

        // Update element history if any tracked property changed
        // Only pass DEFINED values to avoid overwriting existing history values with undefined
        const historyUpdates: Partial<Omit<ElementHistoryEntry, 'id' | 'type' | 'timestamp'>> = {};
        if (updates.width !== undefined) historyUpdates.width = updates.width;
        if (updates.height !== undefined) historyUpdates.height = updates.height;
        if (updates.fillColor !== undefined) historyUpdates.fillColor = updates.fillColor;
        if (updates.fillOpacity !== undefined) historyUpdates.fillOpacity = updates.fillOpacity;
        if (updates.strokeColor !== undefined) historyUpdates.strokeColor = updates.strokeColor;
        if (updates.strokeWidth !== undefined) historyUpdates.strokeWidth = updates.strokeWidth;
        if (updates.strokeOpacity !== undefined) historyUpdates.strokeOpacity = updates.strokeOpacity;
        if (updates.strokeStyle !== undefined) historyUpdates.strokeStyle = updates.strokeStyle;
        if (updates.rotation !== undefined) historyUpdates.rotation = updates.rotation;
        if (updates.cornerRadius !== undefined) historyUpdates.cornerRadius = updates.cornerRadius;
        if (updates.sides !== undefined) historyUpdates.sides = updates.sides;
        if (updates.gradient !== undefined) historyUpdates.gradient = updates.gradient;

        if (Object.keys(historyUpdates).length > 0) {
            updateElementHistory(id, historyUpdates);
        }

        // Use callback form to avoid stale state issues
        setElements(prev => {
            const newElements = prev.map(el => el.id === id ? { ...el, ...updates } : el);
            // Update ref immediately so subsequent operations have latest data
            elementsRef.current = newElements;

            // Trigger debounced database update for the changed element
            const updatedElement = newElements.find(el => el.id === id);
            if (updatedElement) {
                debouncedUpdateElement(updatedElement);
            }

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

            // Trigger debounced database update for each changed element
            updates.forEach((_, id) => {
                const updatedElement = newElements.find(el => el.id === id);
                if (updatedElement) {
                    debouncedUpdateElement(updatedElement);
                }
            });

            return newElements;
        });
    };

    // Flip element horizontally
    const handleFlipHorizontal = (id: string) => {
        const element = elementsRef.current.find(el => el.id === id);
        if (!element) return;

        if (element.type === 'line' || element.type === 'arrow') {
            // For line/arrow, swap the x coordinates of points
            const points = element.points || [0, 0, 100, 0];
            const flippedPoints = [points[2], points[1], points[0], points[3]];
            updateElement(id, { points: flippedPoints });
        } else {
            // For other elements, toggle scaleX
            updateElement(id, { scaleX: (element.scaleX || 1) * -1 });
        }
    };

    // Flip element vertically
    const handleFlipVertical = (id: string) => {
        const element = elementsRef.current.find(el => el.id === id);
        if (!element) return;

        if (element.type === 'line' || element.type === 'arrow') {
            // For line/arrow, swap the y coordinates of points
            const points = element.points || [0, 0, 100, 0];
            const flippedPoints = [points[0], points[3], points[2], points[1]];
            updateElement(id, { points: flippedPoints });
        } else {
            // For other elements, toggle scaleY
            updateElement(id, { scaleY: (element.scaleY || 1) * -1 });
        }
    };

    // Export canvas as PNG
    const handleExportPNG = useCallback(() => {
        if (!stageRef.current) return;

        // Temporarily deselect elements to hide transformer
        const currentSelection = selectedElementIds;
        setSelectedElementIds([]);
        setSelectedImageIds([]);

        // Wait for re-render then export
        setTimeout(() => {
            try {
                const dataURL = stageRef.current.toDataURL({
                    pixelRatio: 2, // Higher quality
                    x: 0,
                    y: 0,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });

                // Create download link
                const link = document.createElement('a');
                link.download = `map-export-${Date.now()}.png`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast.success('Map exported as PNG');
            } catch (error) {
                console.error('Export failed:', error);
                toast.error('Failed to export map');
            }

            // Restore selection
            setSelectedElementIds(currentSelection);
        }, 100);
    }, [selectedElementIds]);

    // Align selected elements
    const handleAlign = useCallback((type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedElementIds.length < 2) return;

        const selected = elementsRef.current.filter(el => selectedElementIds.includes(el.id));
        if (selected.length < 2) return;

        // Calculate bounding box of all selected elements
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        selected.forEach(el => {
            const bounds = getElementBounds(el, el.x, el.y);
            minX = Math.min(minX, bounds.left);
            maxX = Math.max(maxX, bounds.right);
            minY = Math.min(minY, bounds.top);
            maxY = Math.max(maxY, bounds.bottom);
        });

        const updates = new Map<string, Partial<MapElement>>();

        selected.forEach(el => {
            const bounds = getElementBounds(el, el.x, el.y);
            const elWidth = bounds.right - bounds.left;
            const elHeight = bounds.bottom - bounds.top;

            let newX = el.x;
            let newY = el.y;

            switch (type) {
                case 'left':
                    // Align left edges to the leftmost element
                    newX = minX + (el.x - bounds.left);
                    break;
                case 'center':
                    // Align horizontal centers
                    const centerX = (minX + maxX) / 2;
                    newX = centerX - elWidth / 2 + (el.x - bounds.left);
                    break;
                case 'right':
                    // Align right edges to the rightmost element
                    newX = maxX - elWidth + (el.x - bounds.left);
                    break;
                case 'top':
                    // Align top edges to the topmost element
                    newY = minY + (el.y - bounds.top);
                    break;
                case 'middle':
                    // Align vertical centers
                    const centerY = (minY + maxY) / 2;
                    newY = centerY - elHeight / 2 + (el.y - bounds.top);
                    break;
                case 'bottom':
                    // Align bottom edges to the bottommost element
                    newY = maxY - elHeight + (el.y - bounds.top);
                    break;
            }

            if (newX !== el.x || newY !== el.y) {
                updates.set(el.id, { x: newX, y: newY });
            }
        });

        if (updates.size > 0) {
            updateMultipleElements(updates);
        }
    }, [selectedElementIds, updateMultipleElements]);

    // Distribute selected elements evenly
    const handleDistribute = useCallback((type: 'horizontal' | 'vertical') => {
        if (selectedElementIds.length < 3) return;

        const selected = elementsRef.current.filter(el => selectedElementIds.includes(el.id));
        if (selected.length < 3) return;

        // Sort elements by position
        const sortedElements = [...selected].sort((a, b) => {
            const boundsA = getElementBounds(a, a.x, a.y);
            const boundsB = getElementBounds(b, b.x, b.y);
            if (type === 'horizontal') {
                return boundsA.centerX - boundsB.centerX;
            } else {
                return boundsA.centerY - boundsB.centerY;
            }
        });

        // Get first and last element positions
        const firstBounds = getElementBounds(sortedElements[0], sortedElements[0].x, sortedElements[0].y);
        const lastBounds = getElementBounds(sortedElements[sortedElements.length - 1], sortedElements[sortedElements.length - 1].x, sortedElements[sortedElements.length - 1].y);

        const firstCenter = type === 'horizontal' ? firstBounds.centerX : firstBounds.centerY;
        const lastCenter = type === 'horizontal' ? lastBounds.centerX : lastBounds.centerY;

        // Calculate spacing between elements
        const totalDistance = lastCenter - firstCenter;
        const spacing = totalDistance / (sortedElements.length - 1);

        const updates = new Map<string, Partial<MapElement>>();

        // Update positions (skip first and last which stay in place)
        for (let i = 1; i < sortedElements.length - 1; i++) {
            const el = sortedElements[i];
            const bounds = getElementBounds(el, el.x, el.y);
            const currentCenter = type === 'horizontal' ? bounds.centerX : bounds.centerY;
            const targetCenter = firstCenter + spacing * i;
            const offset = targetCenter - currentCenter;

            if (type === 'horizontal') {
                updates.set(el.id, { x: el.x + offset });
            } else {
                updates.set(el.id, { y: el.y + offset });
            }
        }

        if (updates.size > 0) {
            updateMultipleElements(updates);
        }
    }, [selectedElementIds, updateMultipleElements]);

    // Z-order handlers for context menu
    const handleBringForward = useCallback(() => {
        if (selectedElementIds.length !== 1) return;
        const id = selectedElementIds[0];
        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        const currentIdx = sorted.findIndex(el => el.id === id);
        if (currentIdx < sorted.length - 1) {
            const current = sorted[currentIdx];
            const above = sorted[currentIdx + 1];
            updateElement(current.id, { zIndex: above.zIndex });
            updateElement(above.id, { zIndex: current.zIndex });
        }
        setContextMenu(null);
    }, [selectedElementIds, elements, updateElement]);

    const handleSendBackward = useCallback(() => {
        if (selectedElementIds.length !== 1) return;
        const id = selectedElementIds[0];
        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        const currentIdx = sorted.findIndex(el => el.id === id);
        if (currentIdx > 0) {
            const current = sorted[currentIdx];
            const below = sorted[currentIdx - 1];
            updateElement(current.id, { zIndex: below.zIndex });
            updateElement(below.id, { zIndex: current.zIndex });
        }
        setContextMenu(null);
    }, [selectedElementIds, elements, updateElement]);

    const handleBringToFront = useCallback(() => {
        if (selectedElementIds.length !== 1) return;
        const maxZIndex = Math.max(...elements.map(el => el.zIndex), 0);
        updateElement(selectedElementIds[0], { zIndex: maxZIndex + 1 });
        setContextMenu(null);
    }, [selectedElementIds, elements, updateElement]);

    const handleSendToBack = useCallback(() => {
        if (selectedElementIds.length !== 1) return;
        const minZIndex = Math.min(...elements.map(el => el.zIndex), 0);
        updateElement(selectedElementIds[0], { zIndex: minZIndex - 1 });
        setContextMenu(null);
    }, [selectedElementIds, elements, updateElement]);

    const handleToggleVisibility = (id: string) => {
        updateElement(id, { visible: !elements.find(el => el.id === id)?.visible });
    };

    const handleToggleLock = (id: string) => {
        updateElement(id, { locked: !elements.find(el => el.id === id)?.locked });
    };

    // Image visibility handlers for LayersPanel
    const handleToggleImageVisibility = useCallback((id: string) => {
        setUploadedImages(prev => prev.map(img =>
            img.id === id ? { ...img, visible: !img.visible } : img
        ));
        setHasUnsavedChanges(true);
    }, []);

    const handleToggleBackgroundVisibility = useCallback(() => {
        setMapImageVisible(prev => !prev);
        setHasUnsavedChanges(true);
    }, []);

    const handleDeleteImageFromLayers = useCallback((id: string) => {
        setUploadedImages(prev => prev.filter(img => img.id !== id));
        setSelectedImageIds(prev => prev.filter(imgId => imgId !== id));
        setHasUnsavedChanges(true);
    }, []);

    const handleSelectImageFromLayers = useCallback((id: string) => {
        setSelectedImageIds([id]);
        setSelectedElementIds([]);
        setIsImageSelected(false);
    }, []);

    const handleSelectBackgroundFromLayers = useCallback(() => {
        setIsImageSelected(true);
        setSelectedElementIds([]);
        setSelectedImageIds([]);
    }, []);

    const handleReorderElements = (newElements: MapElement[]) => {
        setElements(newElements);
        // Trigger debounced updates for all reordered elements (zIndex may have changed)
        newElements.forEach(el => debouncedUpdateElement(el));
    };

    const selectedElement = selectedElementIds.length === 1 ? elements.find(el => el.id === selectedElementIds[0]) || null : null;

    // Throttled color update to prevent crashes from rapid color picker changes
    // Uses requestAnimationFrame to limit updates to once per frame (~60fps)
    const pendingColorUpdateRef = useRef<{ id: string; color: string } | null>(null);
    const colorUpdateFrameRef = useRef<number | null>(null);

    const throttledColorUpdate = useCallback((id: string, color: string) => {
        pendingColorUpdateRef.current = { id, color };

        if (colorUpdateFrameRef.current === null) {
            colorUpdateFrameRef.current = requestAnimationFrame(() => {
                if (pendingColorUpdateRef.current) {
                    const { id: elementId, color: newColor } = pendingColorUpdateRef.current;
                    updateElement(elementId, { fillColor: newColor });
                    pendingColorUpdateRef.current = null;
                }
                colorUpdateFrameRef.current = null;
            });
        }
    }, [updateElement]);

    // Cleanup animation frame on unmount
    useEffect(() => {
        return () => {
            if (colorUpdateFrameRef.current !== null) {
                cancelAnimationFrame(colorUpdateFrameRef.current);
            }
        };
    }, []);

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

    // Teardrop pin helper - calculates size and radius for teardrop shape
    const getTeardropPinSize = (element: MapElement) => {
        const size = Math.max(element.width, element.height) * 1.2;
        const radius = size * 0.4;
        return { size, radius };
    };

    // Helper to get element bounds based on element type
    const getElementBounds = (element: MapElement, x: number, y: number) => {
        const isCentered = ['circle', 'polygon', 'triangle'].includes(element.type);
        const isPin = ['smart-pin', 'static-pin', 'device-pin'].includes(element.type);

        if (isCentered) {
            // For centered elements, (x, y) is the center
            const halfW = element.width / 2;
            const halfH = element.height / 2;
            return {
                left: x - halfW,
                right: x + halfW,
                top: y - halfH,
                bottom: y + halfH,
                centerX: x,
                centerY: y,
            };
        } else if (isPin) {
            // For pins, (x, y) is the bottom tip, element extends upward
            const halfW = element.width / 2;
            return {
                left: x - halfW,
                right: x + halfW,
                top: y - element.height,
                bottom: y,
                centerX: x,
                centerY: y - element.height / 2,
            };
        } else {
            // For corner-based elements (rectangle, text, etc.), (x, y) is top-left
            return {
                left: x,
                right: x + element.width,
                top: y,
                bottom: y + element.height,
                centerX: x + element.width / 2,
                centerY: y + element.height / 2,
            };
        }
    };

    // Helper to convert snap position back to element (x, y) based on type
    const snapToElementPosition = (
        element: MapElement,
        snapX: number | null,
        snapY: number | null,
        snapType: { x: 'left' | 'right' | 'center' | null; y: 'top' | 'bottom' | 'center' | null }
    ) => {
        const isCentered = ['circle', 'polygon', 'triangle'].includes(element.type);
        const isPin = ['smart-pin', 'static-pin', 'device-pin'].includes(element.type);

        let resultX = snapX;
        let resultY = snapY;

        if (snapX !== null && snapType.x) {
            if (isCentered) {
                if (snapType.x === 'left') resultX = snapX + element.width / 2;
                else if (snapType.x === 'right') resultX = snapX - element.width / 2;
                // center stays as is
            } else if (isPin) {
                if (snapType.x === 'left') resultX = snapX + element.width / 2;
                else if (snapType.x === 'right') resultX = snapX - element.width / 2;
                // center stays as is
            } else {
                // Corner-based: snapX is left edge position
                if (snapType.x === 'left') resultX = snapX;
                else if (snapType.x === 'right') resultX = snapX - element.width;
                else if (snapType.x === 'center') resultX = snapX - element.width / 2;
            }
        }

        if (snapY !== null && snapType.y) {
            if (isCentered) {
                if (snapType.y === 'top') resultY = snapY + element.height / 2;
                else if (snapType.y === 'bottom') resultY = snapY - element.height / 2;
                // center stays as is
            } else if (isPin) {
                // Pin's y is at the bottom tip
                if (snapType.y === 'top') resultY = snapY + element.height;
                else if (snapType.y === 'bottom') resultY = snapY;
                else if (snapType.y === 'center') resultY = snapY + element.height / 2;
            } else {
                // Corner-based: snapY is top edge position
                if (snapType.y === 'top') resultY = snapY;
                else if (snapType.y === 'bottom') resultY = snapY - element.height;
                else if (snapType.y === 'center') resultY = snapY - element.height / 2;
            }
        }

        return { x: resultX, y: resultY };
    };

    // Smart guides helper - calculates alignment guides and snap position
    const SNAP_THRESHOLD = 20; // pixels - magnetic snap like Canva
    const GRID_SIZE = 50; // Match visual grid size

    // Snap position to grid intersection
    const snapToGridPosition = useCallback((value: number): number => {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }, []);

    const calculateSmartGuides = useCallback((
        draggedElement: MapElement,
        currentX: number,
        currentY: number,
        otherElements: MapElement[]
    ): {
        snapX: number | null;
        snapY: number | null;
        guides: { vertical: number[]; horizontal: number[] }
    } => {
        // If Ctrl/Cmd is pressed, disable smart guides
        if (isCtrlCmdPressedRef.current) {
            return { snapX: null, snapY: null, guides: { vertical: [], horizontal: [] } };
        }

        const guides: { vertical: number[]; horizontal: number[] } = { vertical: [], horizontal: [] };

        // Track best snap candidates (closest to threshold)
        let bestSnapX: { value: number; distance: number; type: 'left' | 'right' | 'center'; guide: number } | null = null;
        let bestSnapY: { value: number; distance: number; type: 'top' | 'bottom' | 'center'; guide: number } | null = null;

        // Get the dragged element bounds
        const dragged = getElementBounds(draggedElement, currentX, currentY);

        // Helper to check and update best snap
        const checkSnapX = (draggedEdge: number, targetEdge: number, type: 'left' | 'right' | 'center', guidePos: number) => {
            const distance = Math.abs(draggedEdge - targetEdge);
            if (distance < SNAP_THRESHOLD) {
                if (!bestSnapX || distance < bestSnapX.distance) {
                    bestSnapX = { value: targetEdge, distance, type, guide: guidePos };
                }
                guides.vertical.push(guidePos);
            }
        };

        const checkSnapY = (draggedEdge: number, targetEdge: number, type: 'top' | 'bottom' | 'center', guidePos: number) => {
            const distance = Math.abs(draggedEdge - targetEdge);
            if (distance < SNAP_THRESHOLD) {
                if (!bestSnapY || distance < bestSnapY.distance) {
                    bestSnapY = { value: targetEdge, distance, type, guide: guidePos };
                }
                guides.horizontal.push(guidePos);
            }
        };

        // Check canvas edges
        // Left edge of canvas
        checkSnapX(dragged.left, 0, 'left', 0);
        checkSnapX(dragged.right, 0, 'right', 0);
        checkSnapX(dragged.centerX, 0, 'center', 0);

        // Center of canvas
        checkSnapX(dragged.left, CANVAS_WIDTH / 2, 'left', CANVAS_WIDTH / 2);
        checkSnapX(dragged.right, CANVAS_WIDTH / 2, 'right', CANVAS_WIDTH / 2);
        checkSnapX(dragged.centerX, CANVAS_WIDTH / 2, 'center', CANVAS_WIDTH / 2);

        // Right edge of canvas
        checkSnapX(dragged.left, CANVAS_WIDTH, 'left', CANVAS_WIDTH);
        checkSnapX(dragged.right, CANVAS_WIDTH, 'right', CANVAS_WIDTH);
        checkSnapX(dragged.centerX, CANVAS_WIDTH, 'center', CANVAS_WIDTH);

        // Top edge of canvas
        checkSnapY(dragged.top, 0, 'top', 0);
        checkSnapY(dragged.bottom, 0, 'bottom', 0);
        checkSnapY(dragged.centerY, 0, 'center', 0);

        // Center of canvas
        checkSnapY(dragged.top, CANVAS_HEIGHT / 2, 'top', CANVAS_HEIGHT / 2);
        checkSnapY(dragged.bottom, CANVAS_HEIGHT / 2, 'bottom', CANVAS_HEIGHT / 2);
        checkSnapY(dragged.centerY, CANVAS_HEIGHT / 2, 'center', CANVAS_HEIGHT / 2);

        // Bottom edge of canvas
        checkSnapY(dragged.top, CANVAS_HEIGHT, 'top', CANVAS_HEIGHT);
        checkSnapY(dragged.bottom, CANVAS_HEIGHT, 'bottom', CANVAS_HEIGHT);
        checkSnapY(dragged.centerY, CANVAS_HEIGHT, 'center', CANVAS_HEIGHT);

        // Check against other elements
        for (const other of otherElements) {
            if (other.id === draggedElement.id || other.visible === false) continue;

            const otherBounds = getElementBounds(other, other.x, other.y);

            // Vertical alignment (X axis) - check all edge combinations
            // Left edges align
            checkSnapX(dragged.left, otherBounds.left, 'left', otherBounds.left);
            // Right edges align
            checkSnapX(dragged.right, otherBounds.right, 'right', otherBounds.right);
            // Centers align
            checkSnapX(dragged.centerX, otherBounds.centerX, 'center', otherBounds.centerX);
            // Left to right (dragged left touches other right)
            checkSnapX(dragged.left, otherBounds.right, 'left', otherBounds.right);
            // Right to left (dragged right touches other left)
            checkSnapX(dragged.right, otherBounds.left, 'right', otherBounds.left);

            // Horizontal alignment (Y axis) - check all edge combinations
            // Top edges align
            checkSnapY(dragged.top, otherBounds.top, 'top', otherBounds.top);
            // Bottom edges align
            checkSnapY(dragged.bottom, otherBounds.bottom, 'bottom', otherBounds.bottom);
            // Centers align
            checkSnapY(dragged.centerY, otherBounds.centerY, 'center', otherBounds.centerY);
            // Top to bottom (dragged top touches other bottom)
            checkSnapY(dragged.top, otherBounds.bottom, 'top', otherBounds.bottom);
            // Bottom to top (dragged bottom touches other top)
            checkSnapY(dragged.bottom, otherBounds.top, 'bottom', otherBounds.top);
        }

        // Remove duplicates from guides
        guides.vertical = [...new Set(guides.vertical)];
        guides.horizontal = [...new Set(guides.horizontal)];

        // Calculate final snap position
        let snapX: number | null = null;
        let snapY: number | null = null;

        if (bestSnapX) {
            // Convert the snap position back to element x coordinate
            const result = snapToElementPosition(
                draggedElement,
                bestSnapX.value,
                null,
                { x: bestSnapX.type, y: null }
            );
            snapX = result.x;
        }

        if (bestSnapY) {
            // Convert the snap position back to element y coordinate
            const result = snapToElementPosition(
                draggedElement,
                null,
                bestSnapY.value,
                { x: null, y: bestSnapY.type }
            );
            snapY = result.y;
        }

        return { snapX, snapY, guides };
    }, []);

    // Render element
    const renderElement = (element: MapElement) => {
        if (!element.visible) return null;

        const isSelected = selectedElementIds.includes(element.id);
        const commonProps = {
            id: element.id,
            x: element.x,
            y: element.y,
            rotation: element.rotation,
            scaleX: element.scaleX || 1,
            scaleY: element.scaleY || 1,
            draggable: !element.locked && tool === 'select',
            onClick: () => {
                if (tool === 'eraser') {
                    // Eraser tool - delete the element
                    handleDeleteElement(element.id);
                    return;
                }
                if (tool === 'select') {
                    // Use ref to get latest selection (avoid stale closure)
                    const currentlySelected = selectedElementIdsRef.current.includes(element.id);
                    // If clicking on an already-selected element, keep the multi-selection
                    // Otherwise, select only this element
                    if (!currentlySelected) {
                        setSelectedElementIds([element.id]);
                        setIsImageSelected(false);
                        setSelectedImageIds([]);
                    }
                }
            },
            onTap: () => {
                if (tool === 'eraser') {
                    // Eraser tool - delete the element
                    handleDeleteElement(element.id);
                    return;
                }
                if (tool === 'select') {
                    // Use ref to get latest selection (avoid stale closure)
                    const currentlySelected = selectedElementIdsRef.current.includes(element.id);
                    // Same logic for touch
                    if (!currentlySelected) {
                        setSelectedElementIds([element.id]);
                        setIsImageSelected(false);
                        setSelectedImageIds([]);
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
                    setIsImageSelected(false);
                    setSelectedImageIds([]);
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
            onDragMove: (e: any) => {
                // Update toolbar position in real-time during drag
                const node = e.target;
                const currentEl = elementsRef.current.find(el => el.id === element.id);
                if (!currentEl) return;

                let toolbarX: number, toolbarY: number;
                let currentX = node.x();
                let currentY = node.y();

                if (currentEl.type === 'line' || currentEl.type === 'arrow') {
                    // For lines/arrows, calculate center from points + current drag offset
                    const points = currentEl.points || [0, 0, 100, 0];
                    const dragOffsetX = node.x();
                    const dragOffsetY = node.y();
                    toolbarX = (points[0] + points[2]) / 2 + dragOffsetX;
                    toolbarY = Math.min(points[1], points[3]) + dragOffsetY;
                    // Update drag offset ref so anchor circles can follow
                    lineArrowDragOffsetRef.current = { x: dragOffsetX, y: dragOffsetY };
                    // Clear guides for line-based elements
                    setSmartGuides({ vertical: [], horizontal: [] });
                } else if (currentEl.type === 'freehand') {
                    // For freehand, use current node position
                    const points = currentEl.freehandPoints || [];
                    const dragOffsetX = node.x();
                    const dragOffsetY = node.y();
                    const minY = points.length > 1 ? Math.min(...points.filter((_, i) => i % 2 === 1)) : currentEl.y;
                    const avgX = points.length > 1 ? points.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (points.length / 2) : currentEl.x;
                    toolbarX = avgX + dragOffsetX;
                    toolbarY = minY + dragOffsetY;
                    // Clear guides for freehand
                    setSmartGuides({ vertical: [], horizontal: [] });
                } else {
                    // For regular shapes, apply snapping during drag
                    let snappedX = currentX;
                    let snappedY = currentY;

                    if (snapToGrid) {
                        // Grid snapping - snap to nearest grid intersection
                        snappedX = snapToGridPosition(currentX);
                        snappedY = snapToGridPosition(currentY);
                        node.x(snappedX);
                        node.y(snappedY);
                        // Clear smart guides when using grid snap
                        setSmartGuides({ vertical: [], horizontal: [] });
                    } else {
                        // Smart guides snapping
                        const { snapX, snapY, guides } = calculateSmartGuides(
                            currentEl,
                            currentX,
                            currentY,
                            elementsRef.current
                        );

                        if (snapX !== null) {
                            snappedX = snapX;
                            node.x(snapX);
                        }
                        if (snapY !== null) {
                            snappedY = snapY;
                            node.y(snapY);
                        }

                        // Show guides during drag
                        setSmartGuides(guides);
                    }

                    if (currentEl.type === 'smart-pin') {
                        // For smart pins, calculate toolbar position at top of pin during drag
                        const pinSize = Math.max(currentEl.width, currentEl.height) * 1.2;
                        const pinRadius = pinSize * 0.4;
                        toolbarX = snappedX;
                        toolbarY = snappedY - pinRadius - pinRadius * 0.2 - pinRadius;
                    } else if (currentEl.type === 'static-pin') {
                        // For static pins, calculate toolbar position at top of pin during drag
                        const staticPinHeight = (currentEl.height || 55) * 0.7;
                        const staticPointerHeight = (currentEl.height || 55) * 0.3;
                        toolbarX = snappedX;
                        toolbarY = snappedY - staticPinHeight - staticPointerHeight;
                    } else if (currentEl.type === 'device-pin') {
                        // For device pins, calculate toolbar position at top of screen during drag
                        const devicePinHeight = currentEl.height || 60;
                        const screenHeight = devicePinHeight * 0.70;
                        const standHeight = devicePinHeight * 0.30;
                        toolbarX = snappedX;
                        toolbarY = snappedY - screenHeight - standHeight;
                    } else {
                        // For regular shapes, use snapped position
                        toolbarX = snappedX + currentEl.width / 2;
                        toolbarY = snappedY;
                    }
                }

                setToolbarPosition({ x: toolbarX, y: toolbarY });
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
                    // Reset drag offset ref since drag is complete
                    lineArrowDragOffsetRef.current = { x: 0, y: 0 };
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
                        // For regular shapes, apply smart guides snapping on drag end
                        let finalX = startPos.x + deltaX;
                        let finalY = startPos.y + deltaY;

                        // Apply snapping (grid snap takes priority, then smart guides)
                        if (!isCtrlCmdPressedRef.current) {
                            if (snapToGrid) {
                                // Grid snapping - snap to nearest grid intersection
                                finalX = snapToGridPosition(finalX);
                                finalY = snapToGridPosition(finalY);
                            } else {
                                // Smart guides snapping
                                const { snapX, snapY } = calculateSmartGuides(
                                    currentElement,
                                    finalX,
                                    finalY,
                                    elementsRef.current
                                );
                                if (snapX !== null) finalX = snapX;
                                if (snapY !== null) finalY = snapY;
                            }
                        }

                        updateElement(currentElement.id, {
                            x: finalX,
                            y: finalY,
                        });
                    }
                }

                // Clear drag start positions
                dragStartPositionsRef.current.clear();

                // Clear smart guides
                setSmartGuides({ vertical: [], horizontal: [] });
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

        // Render name label if enabled - centered on the element
        const renderLabel = () => {
            // Don't show label if: no name, hidden, layers-only, or currently being edited
            if (!element.name || element.showNameOn === 'none' || element.showNameOn === 'layers') return null;
            if (editingLabelId === element.id) return null; // Hide while editing

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
                // For top-left shapes (rect, etc.), the group origin is top-left
                x = 0;
                y = 0;
            }

            return (
                <KonvaText
                    text={element.name}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fontSize={element.labelFontSize || 28}
                    fontFamily={element.labelFontFamily || 'Arial'}
                    fontStyle={element.labelFontWeight || 'normal'}
                    fill={element.labelColor || '#000000'}
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
                            {...getGradientProps(element)}
                            opacity={element.fillOpacity}
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            cornerRadius={element.cornerRadius}
                            dash={getStrokeDash(element.strokeStyle)}
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
                            {...getGradientProps(element)}
                            opacity={element.fillOpacity}
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            dash={getStrokeDash(element.strokeStyle)}
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
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            dash={getStrokeDash(element.strokeStyle)}
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
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            lineJoin="round"
                            cornerRadius={element.cornerRadius || 0}
                            dash={getStrokeDash(element.strokeStyle)}
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
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            lineJoin="round"
                            cornerRadius={element.cornerRadius || 0}
                            dash={getStrokeDash(element.strokeStyle)}
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
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            dash={getStrokeDash(element.strokeStyle)}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'line':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={element.points || [0, 0, 100, 0]}
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            hitStrokeWidth={40}
                            dash={getStrokeDash(element.strokeStyle)}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'arrow':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Arrow
                            points={element.points || [0, 0, 100, 0]}
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            fill={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            hitStrokeWidth={40}
                            dash={getStrokeDash(element.strokeStyle)}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'text':
                // Calculate shadow properties (either explicit shadow or glow effect)
                const textShadowEnabled = element.textShadow?.enabled || element.textGlow?.enabled;
                const textShadowColor = element.textGlow?.enabled
                    ? element.textGlow.color
                    : (element.textShadow?.color || '#000000');
                const textShadowBlur = element.textGlow?.enabled
                    ? element.textGlow.blur
                    : (element.textShadow?.blur || 0);
                const textShadowOffsetX = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetX || 0);
                const textShadowOffsetY = element.textGlow?.enabled ? 0 : (element.textShadow?.offsetY || 0);

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
                        {/* Text content - hidden while editing */}
                        {editingLabelId !== element.id && (
                            <KonvaText
                                text={element.text || 'Text'}
                                fontSize={element.fontSize}
                                fontFamily={element.fontFamily}
                                fontStyle={element.fontWeight}
                                fill={element.fillColor}
                                align={element.textAlign}
                                width={element.width}
                                padding={10}
                                letterSpacing={element.letterSpacing || 0}
                                lineHeight={element.lineHeight || 1}
                                textDecoration={element.textDecoration || 'none'}
                                // Shadow and glow effects
                                shadowEnabled={textShadowEnabled}
                                shadowColor={textShadowColor}
                                shadowBlur={textShadowBlur}
                                shadowOffsetX={textShadowOffsetX}
                                shadowOffsetY={textShadowOffsetY}
                                // Outline effect (stroke)
                                stroke={element.textOutline?.enabled ? element.textOutline.color : undefined}
                                strokeWidth={element.textOutline?.enabled ? element.textOutline.width : 0}
                            />
                        )}
                    </Group>
                );
            case 'freehand':
                return (
                    <Group key={element.id} {...commonProps}>
                        <Line
                            points={element.freehandPoints || []}
                            stroke={applyOpacityToColor(element.strokeColor, element.strokeOpacity)}
                            strokeWidth={element.strokeWidth}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            hitStrokeWidth={20}
                            dash={getStrokeDash(element.strokeStyle)}
                        />
                        {renderLabel()}
                    </Group>
                );
            case 'smart-pin':
                const { size: smartSize, radius: smartRadius } = getTeardropPinSize(element);
                const smartCircleY = -smartRadius - smartRadius * 0.2;
                const smartInnerRadius = smartRadius * 0.45;
                // Ensure valid color values with fallbacks
                const smartFillColor = element.fillColor || '#ef4444';
                const smartStrokeColor = element.strokeColor || '#b91c1c';
                const smartFillOpacity = element.fillOpacity ?? 1;
                const smartStrokeWidth = element.strokeWidth ?? 2;
                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Teardrop outer circle */}
                        <Circle
                            x={0}
                            y={smartCircleY}
                            radius={smartRadius}
                            fill={smartFillColor}
                            opacity={smartFillOpacity}
                            stroke={smartStrokeColor}
                            strokeWidth={smartStrokeWidth}
                        />
                        {/* Bottom triangle point */}
                        <Line
                            points={[
                                -smartRadius * 0.7, smartCircleY + smartRadius * 0.5,
                                smartRadius * 0.7, smartCircleY + smartRadius * 0.5,
                                0, smartSize * 0.35,
                            ]}
                            closed={true}
                            fill={smartFillColor}
                            opacity={smartFillOpacity}
                            stroke={smartStrokeColor}
                            strokeWidth={smartStrokeWidth}
                            lineJoin="round"
                        />
                        {/* Cover stroke between circle and triangle */}
                        <Line
                            points={[
                                -smartRadius * 0.65, smartCircleY + smartRadius * 0.5,
                                smartRadius * 0.65, smartCircleY + smartRadius * 0.5,
                            ]}
                            stroke={smartFillColor}
                            strokeWidth={4}
                            opacity={smartFillOpacity}
                            listening={false}
                        />
                        {/* Inner white circle (hollow center) */}
                        <Circle
                            x={0}
                            y={smartCircleY}
                            radius={smartInnerRadius}
                            fill="#ffffff"
                            listening={false}
                        />
                        {/* Selection highlight */}
                        {isSelected && (
                            <Circle
                                x={0}
                                y={smartCircleY}
                                radius={smartRadius + 2}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                listening={false}
                            />
                        )}
                        {renderLabel()}
                    </Group>
                );
            case 'static-pin':
                // Cornered square badge design with pointer at bottom
                const staticPinWidth = element.width || 55;
                const staticPinHeight = (element.height || 55) * 0.7; // Rectangle body height
                const staticPointerHeight = (element.height || 55) * 0.3; // Pointer triangle height
                const staticCornerRadius = 6;
                const labelFontSize = element.pinLabelFontSize || 16;
                const labelColor = element.pinLabelColor || '#ffffff';
                const labelFontWeight = element.pinLabelFontWeight || 'normal';
                const labelFontFamily = element.pinLabelFontFamily || 'Inter, system-ui, -apple-system, sans-serif';
                // Ensure valid color values with fallbacks
                const staticFillColor = element.fillColor || '#22c55e';
                const staticStrokeColor = element.strokeColor || '#15803d';
                const staticFillOpacity = element.fillOpacity ?? 1;
                const staticStrokeWidth = element.strokeWidth ?? 2;

                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Rectangle body with rounded corners */}
                        <Rect
                            x={-staticPinWidth / 2}
                            y={-staticPinHeight - staticPointerHeight}
                            width={staticPinWidth}
                            height={staticPinHeight}
                            fill={staticFillColor}
                            opacity={staticFillOpacity}
                            stroke={staticStrokeColor}
                            strokeWidth={staticStrokeWidth}
                            cornerRadius={staticCornerRadius}
                        />
                        {/* Triangular pointer at bottom */}
                        <Line
                            points={[
                                -staticPinWidth * 0.2, -staticPointerHeight,
                                staticPinWidth * 0.2, -staticPointerHeight,
                                0, 0,
                            ]}
                            closed={true}
                            fill={staticFillColor}
                            opacity={staticFillOpacity}
                            stroke={staticStrokeColor}
                            strokeWidth={staticStrokeWidth}
                            lineJoin="round"
                        />
                        {/* Cover the stroke line between rectangle and pointer */}
                        <Line
                            points={[
                                -staticPinWidth * 0.18, -staticPointerHeight,
                                staticPinWidth * 0.18, -staticPointerHeight,
                            ]}
                            stroke={staticFillColor}
                            strokeWidth={staticStrokeWidth + 2}
                            opacity={staticFillOpacity}
                            listening={false}
                        />
                        {/* Pin label inside rectangle - hidden while editing */}
                        {editingLabelId !== element.id && (
                            <KonvaText
                                text={element.pinLabel || ''}
                                x={-staticPinWidth / 2}
                                y={-staticPinHeight - staticPointerHeight}
                                width={staticPinWidth}
                                height={staticPinHeight}
                                fontSize={labelFontSize}
                                fontFamily={labelFontFamily}
                                fontStyle={labelFontWeight}
                                fill={labelColor}
                                align="center"
                                verticalAlign="middle"
                                listening={false}
                            />
                        )}
                        {/* Selection highlight */}
                        {isSelected && (
                            <Rect
                                x={-staticPinWidth / 2 - 2}
                                y={-staticPinHeight - staticPointerHeight - 2}
                                width={staticPinWidth + 4}
                                height={staticPinHeight + 4}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                cornerRadius={staticCornerRadius}
                                listening={false}
                            />
                        )}
                        {renderLabel()}
                    </Group>
                );
            case 'device-pin':
                // Kiosk/screen design with monitor and stand (no pointer)
                const devicePinWidth = element.width || 50;
                const devicePinHeight = element.height || 60;
                const screenHeight = devicePinHeight * 0.70; // Screen is 70% of total height
                const standHeight = devicePinHeight * 0.30; // Stand neck + base is 30%
                const screenCornerRadius = 4;
                const deviceLabelFontSize = element.pinLabelFontSize || 14;
                const deviceLabelColor = element.pinLabelColor || '#ffffff';
                const deviceLabelFontWeight = element.pinLabelFontWeight || 'normal';
                const deviceLabelFontFamily = element.pinLabelFontFamily || 'Inter, system-ui, -apple-system, sans-serif';
                // Use a single color for the entire device pin (no separate stroke)
                const deviceFillColor = element.fillColor || '#6366f1';
                const deviceFillOpacity = element.fillOpacity ?? 1;

                return (
                    <Group key={element.id} {...commonProps}>
                        {/* Screen/monitor body - no stroke, single color */}
                        <Rect
                            x={-devicePinWidth / 2}
                            y={-screenHeight - standHeight}
                            width={devicePinWidth}
                            height={screenHeight}
                            fill={deviceFillColor}
                            opacity={deviceFillOpacity}
                            cornerRadius={screenCornerRadius}
                        />
                        {/* Screen inner area (darker overlay for depth) */}
                        <Rect
                            x={-devicePinWidth / 2 + 4}
                            y={-screenHeight - standHeight + 4}
                            width={devicePinWidth - 8}
                            height={screenHeight - 8}
                            fill="#000000"
                            opacity={0.25}
                            cornerRadius={2}
                            listening={false}
                        />
                        {/* Stand neck - same color as body */}
                        <Rect
                            x={-devicePinWidth * 0.1}
                            y={-standHeight}
                            width={devicePinWidth * 0.2}
                            height={standHeight * 0.6}
                            fill={deviceFillColor}
                            opacity={deviceFillOpacity}
                        />
                        {/* Stand base - same color as body */}
                        <Rect
                            x={-devicePinWidth * 0.35}
                            y={-standHeight * 0.4}
                            width={devicePinWidth * 0.7}
                            height={standHeight * 0.4}
                            fill={deviceFillColor}
                            opacity={deviceFillOpacity}
                            cornerRadius={2}
                        />
                        {/* Pin label inside screen - hidden while editing */}
                        {editingLabelId !== element.id && (
                            <KonvaText
                                text={element.pinLabel || ''}
                                x={-devicePinWidth / 2 + 4}
                                y={-screenHeight - standHeight + 4}
                                width={devicePinWidth - 8}
                                height={screenHeight - 8}
                                fontSize={deviceLabelFontSize}
                                fontFamily={deviceLabelFontFamily}
                                fontStyle={deviceLabelFontWeight}
                                fill={deviceLabelColor}
                                align="center"
                                verticalAlign="middle"
                                listening={false}
                            />
                        )}
                        {/* Selection highlight */}
                        {isSelected && (
                            <Rect
                                x={-devicePinWidth / 2 - 2}
                                y={-screenHeight - standHeight - 2}
                                width={devicePinWidth + 4}
                                height={screenHeight + 4}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                cornerRadius={screenCornerRadius}
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

    // Show loading spinner during initial data load
    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] gap-4 bg-muted/20 rounded-lg border-2 border-dashed border-border">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading store map...</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col border rounded-lg overflow-hidden bg-background">
            {/* Hidden file input for uploading images from sidebar */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
            />

            {/* Top Bar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Map Editor</h2>
                </div>

                {/* Header Toolbar - Shows element properties when selected */}
                {selectedElement && (
                    <div className="flex-1 flex items-center justify-center gap-2 px-4">
                        {/* Fill Color */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Fill:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                        <div
                                            className="w-5 h-5 rounded border border-border"
                                            style={{ backgroundColor: selectedElement.fillColor }}
                                        />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" side="bottom">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Fill Color</label>
                                        <Input
                                            type="color"
                                            value={selectedElement.fillColor || '#3b82f6'}
                                            onChange={(e) => throttledColorUpdate(selectedElement.id, e.target.value)}
                                            className="w-24 h-8 cursor-pointer"
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Stroke Color - only for shapes */}
                        {selectedElement.type !== 'text' && selectedElement.type !== 'smart-pin' && selectedElement.type !== 'static-pin' && selectedElement.type !== 'device-pin' && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Stroke:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                            <div
                                                className="w-5 h-5 rounded border-2"
                                                style={{ borderColor: selectedElement.strokeColor, backgroundColor: 'transparent' }}
                                            />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-3" side="bottom">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">Stroke Color</label>
                                            <Input
                                                type="color"
                                                value={selectedElement.strokeColor}
                                                onChange={(e) => updateElement(selectedElement.id, { strokeColor: e.target.value })}
                                                className="w-24 h-8 cursor-pointer"
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Stroke Width - for lines/arrows */}
                        {(selectedElement.type === 'line' || selectedElement.type === 'arrow' || selectedElement.type === 'freehand') && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Width:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                                            {selectedElement.strokeWidth || 2}px
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-3" side="bottom">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">
                                                Width: {selectedElement.strokeWidth || 2}px
                                            </label>
                                            <Slider
                                                value={[selectedElement.strokeWidth || 2]}
                                                onValueChange={([value]) => updateElement(selectedElement.id, { strokeWidth: value })}
                                                min={1}
                                                max={20}
                                                step={1}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Corner Radius - for shapes */}
                        {['rectangle', 'trapezoid', 'parallelogram'].includes(selectedElement.type) && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Radius:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                                            {selectedElement.cornerRadius || 0}px
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-3" side="bottom">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">
                                                Radius: {selectedElement.cornerRadius || 0}px
                                            </label>
                                            <Slider
                                                value={[selectedElement.cornerRadius || 0]}
                                                onValueChange={([value]) => updateElement(selectedElement.id, { cornerRadius: value })}
                                                min={0}
                                                max={50}
                                                step={1}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Font Size - for text */}
                        {selectedElement.type === 'text' && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Size:</span>
                                <Select
                                    value={String(selectedElement.fontSize || 24)}
                                    onValueChange={(v) => updateElement(selectedElement.id, { fontSize: Number(v) })}
                                >
                                    <SelectTrigger className="h-8 w-16 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[12, 14, 16, 18, 24, 32, 48, 64, 72, 96].map(size => (
                                            <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Bold toggle - for text */}
                        {selectedElement.type === 'text' && (
                            <Button
                                variant={selectedElement.fontWeight === 'bold' ? 'secondary' : 'outline'}
                                size="sm"
                                className="h-8 w-8 font-bold"
                                onClick={() => updateElement(selectedElement.id, {
                                    fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold'
                                })}
                            >
                                B
                            </Button>
                        )}

                        {/* Animation - for pins */}
                        {(selectedElement.type === 'smart-pin' || selectedElement.type === 'static-pin' || selectedElement.type === 'device-pin') && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Animation:</span>
                                <Select
                                    value={String(selectedElement.animationStyle ?? 0)}
                                    onValueChange={(v) => updateElement(selectedElement.id, { animationStyle: Number(v) as AnimationStyle })}
                                >
                                    <SelectTrigger className="h-8 w-28 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(animationStyleLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Motion Scale (Animation Speed) - for pins */}
                        {(selectedElement.type === 'smart-pin' || selectedElement.type === 'static-pin' || selectedElement.type === 'device-pin') && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Speed:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                                            {(selectedElement.motionScale ?? 1).toFixed(1)}x
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-44 p-3" side="bottom">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">
                                                Speed: {(selectedElement.motionScale ?? 1).toFixed(1)}x
                                            </label>
                                            <Slider
                                                value={[selectedElement.motionScale ?? 1]}
                                                onValueChange={([value]) => updateElement(selectedElement.id, { motionScale: value })}
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
                            </div>
                        )}

                        {/* Separator */}
                        <div className="w-px h-6 bg-border mx-1" />

                        {/* Delete */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteElement(selectedElement.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Align/Distribute buttons - visible when 2+ elements selected */}
                {selectedElementIds.length >= 2 && (
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Align:</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('left')} title="Align left">
                            <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('center')} title="Align center">
                            <AlignCenter className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('right')} title="Align right">
                            <AlignRight className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('top')} title="Align top">
                            <AlignVerticalJustifyStart className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('middle')} title="Align middle">
                            <AlignVerticalJustifyCenter className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAlign('bottom')} title="Align bottom">
                            <AlignVerticalJustifyEnd className="h-4 w-4" />
                        </Button>
                        {selectedElementIds.length >= 3 && (
                            <>
                                <div className="w-px h-6 bg-border mx-1" />
                                <span className="text-xs text-muted-foreground mx-1">Distribute:</span>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDistribute('horizontal')} title="Distribute horizontally">
                                    <MoveHorizontal className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDistribute('vertical')} title="Distribute vertically">
                                    <MoveVertical className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        <div className="w-px h-6 bg-border mx-2" />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGrid(!showGrid)}
                        title="Toggle grid lines for alignment"
                    >
                        <Grid className="h-4 w-4 mr-2" />
                        {showGrid ? 'Hide Grid' : 'Show Grid'}
                    </Button>
                    <Button
                        variant={snapToGrid ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setSnapToGrid(!snapToGrid)}
                        title="Snap elements to grid intersections (50px)"
                    >
                        <Magnet className="h-4 w-4 mr-2" />
                        {snapToGrid ? 'Snap On' : 'Snap Off'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPNG} title="Export as PNG">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetZoom}>
                        {Math.round((scale / 0.56) * 100)}%
                    </Button>
                    {/* Auto-save indicator */}
                    {autoSaving && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm px-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Saving...</span>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPreviewOpen(true)}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                    </Button>
                    <Button
                        size="sm"
                        onClick={handlePublish}
                        disabled={isPublishing || !hasLocalDraftChanges()}
                    >
                        {isPublishing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4 mr-2" />
                        )}
                        {isPublishing ? 'Publishing...' : 'Publish'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Tools */}
                <Sidebar
                    activeTool={tool}
                    onToolChange={setTool}
                    onUploadClick={() => fileInputRef.current?.click()}
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
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleResetZoom} title="Reset Zoom to 100%">
                            <Maximize className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={showCaptureArea ? "default" : "ghost"}
                            size="icon"
                            onClick={handleToggleCaptureArea}
                            title={showCaptureArea ? "Hide Capture Area" : "Show Capture Area"}
                        >
                            <Monitor className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Capture Area Info - only show when capture area is visible */}
                    {showCaptureArea && (
                        <div className="absolute bottom-4 left-20 z-10 bg-card/90 border border-border rounded-md px-2.5 py-1.5 text-xs shadow-sm">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 border-2 border-blue-500 rounded-sm" />
                                <span className="text-muted-foreground">Capture Area:</span>
                                <span className="font-medium">{CANVAS_WIDTH} × {CANVAS_HEIGHT}px</span>
                            </div>
                        </div>
                    )}

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
                            // Spacebar + left-click to drag canvas (pan mode)
                            if (e.evt.button === 0 && isSpacePressedRef.current) {
                                setIsSpaceDragging(true);
                                e.evt.preventDefault();
                                return;
                            }
                            // Right-click to show context menu
                            if (e.evt.button === 2) {
                                e.evt.preventDefault();

                                // Get click position relative to canvas container
                                const containerRect = canvasContainerRef.current?.getBoundingClientRect();
                                if (!containerRect) return;

                                const menuX = e.evt.clientX - containerRect.left;
                                const menuY = e.evt.clientY - containerRect.top;

                                // Determine what was clicked on
                                const target = e.target;
                                const stage = target.getStage();
                                const clickedOnEmpty = target === stage || target.getType() === 'Layer' || target.name() === 'grid-line';

                                // Get clicked element ID if any
                                let clickedElementId: string | null = null;
                                let clickedImageId: string | null = null;

                                if (!clickedOnEmpty) {
                                    // Check if clicked on an element
                                    const targetId = target.id?.();
                                    if (targetId && targetId !== stage?.id()) {
                                        clickedElementId = targetId;
                                        // Select the element if not already selected
                                        if (!selectedElementIds.includes(targetId)) {
                                            setSelectedElementIds([targetId]);
                                            setSelectedImageIds([]);
                                            setIsImageSelected(false);
                                        }
                                    }

                                    // Check if clicked on an uploaded image
                                    const targetName = target.name?.();
                                    if (targetName?.startsWith('uploaded-image-')) {
                                        clickedImageId = targetName.replace('uploaded-image-', '');
                                    }
                                }

                                setContextMenu({
                                    x: menuX,
                                    y: menuY,
                                    visible: true,
                                    targetElementId: clickedElementId,
                                    targetImageId: clickedImageId,
                                    isOnCanvas: clickedOnEmpty,
                                });
                                return;
                            } else {
                                // Close context menu on any left-click
                                if (contextMenu) {
                                    setContextMenu(null);
                                }

                                // Left-click - check if clicking on stage background or empty space
                                const target = e.target;
                                const stage = target.getStage();

                                // Consider it empty if clicking on Stage, Layer, or grid (not background image - it's selectable now)
                                const clickedOnEmpty =
                                    target === stage ||
                                    target.getType() === 'Layer' ||
                                    target.name() === 'grid-line';

                                // Handle eraser tool - start erasing on any image
                                if (tool === 'eraser') {
                                    const pos = getCanvasPositionFromKonvaEvent(e);
                                    if (pos) {
                                        // Find which image the cursor is over
                                        const imageId = findImageAtPosition(pos.x, pos.y);
                                        if (imageId) {
                                            setErasingImageId(imageId);
                                            setIsErasing(true);

                                            // Store position relative to image
                                            if (imageId === '__legacy_map_image__') {
                                                const relX = pos.x - mapImagePositionRef.current.x;
                                                const relY = pos.y - mapImagePositionRef.current.y;
                                                setCurrentEraserStroke([relX, relY]);
                                            } else {
                                                const img = uploadedImagesRef.current.find(i => i.id === imageId);
                                                if (img) {
                                                    const relX = pos.x - img.x;
                                                    const relY = pos.y - img.y;
                                                    setCurrentEraserStroke([relX, relY]);
                                                }
                                            }
                                        }
                                    }
                                    return;
                                }

                                if (clickedOnEmpty && tool === 'select') {
                                    // In crop mode, don't clear selections or start selection box
                                    // User should only interact with the crop box
                                    if (cropModeEnabled) {
                                        return;
                                    }

                                    // Clear any existing selection when starting a new selection box
                                    setSelectedElementIds([]);
                                    setIsImageSelected(false);
                                    setSelectedImageIds([]);

                                    // Start selection box - use Layer's getRelativePointerPosition
                                    const pos = getCanvasPositionFromKonvaEvent(e);
                                    if (pos) {
                                        setSelectionBox({
                                            startX: pos.x,
                                            startY: pos.y,
                                            endX: pos.x,
                                            endY: pos.y,
                                            active: true,
                                        });
                                    }
                                } else {
                                    handleStageClick(e);
                                }
                            }
                        }}
                        onMouseMove={(e) => {
                            // Track eraser cursor position
                            if (tool === 'eraser') {
                                const pos = getCanvasPositionFromKonvaEvent(e);
                                if (pos) {
                                    setEraserCursorPos({ x: pos.x, y: pos.y });
                                }
                            } else {
                                setEraserCursorPos(null);
                            }

                            if (isRightMouseDown || isSpaceDragging) {
                                // Pan the canvas (right-click or spacebar+drag)
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
                                // Update selection box - use Layer's getRelativePointerPosition
                                const pos = getCanvasPositionFromKonvaEvent(e);
                                if (pos) {
                                    setSelectionBox(prev => prev ? {
                                        ...prev,
                                        endX: pos.x,
                                        endY: pos.y,
                                    } : null);
                                }
                            } else {
                                handleStageMouseMove(e);
                            }
                        }}
                        onMouseUp={(e) => {
                            if (e.evt.button === 2) {
                                setIsRightMouseDown(false);
                            }
                            if (e.evt.button === 0 && isSpaceDragging) {
                                setIsSpaceDragging(false);
                                return;
                            }
                            if (selectionBox?.active) {
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

                                // Also find uploaded images that intersect with selection box
                                const selectedImages = uploadedImages.filter(img => {
                                    const imgMinX = img.x;
                                    const imgMaxX = img.x + img.width;
                                    const imgMinY = img.y;
                                    const imgMaxY = img.y + img.height;
                                    // Check intersection
                                    return !(imgMaxX < minX || imgMinX > maxX || imgMaxY < minY || imgMinY > maxY);
                                });

                                console.log('Selection box complete:', {
                                    box: { minX, maxX, minY, maxY },
                                    totalElements: elements.length,
                                    selectedElementCount: selectedElements.length,
                                    selectedElementIds: selectedElements.map(el => el.id),
                                    selectedImageCount: selectedImages.length,
                                    selectedImageIds: selectedImages.map(img => img.id)
                                });

                                // Select all elements and images found
                                if (selectedElements.length > 0 || selectedImages.length > 0) {
                                    // Set selected elements
                                    const newSelectedElementIds = selectedElements.map(el => el.id);
                                    selectedElementIdsRef.current = newSelectedElementIds;
                                    setSelectedElementIds(newSelectedElementIds);

                                    // Set selected images
                                    const newSelectedImageIds = selectedImages.map(img => img.id);
                                    setSelectedImageIds(newSelectedImageIds);

                                    const totalSelected = selectedElements.length + selectedImages.length;
                                    toast.success(`Selected ${totalSelected} item${totalSelected > 1 ? 's' : ''}`);
                                } else {
                                    selectedElementIdsRef.current = [];
                                    setSelectedElementIds([]);
                                    setSelectedImageIds([]);
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
                        style={{
                            width: CANVAS_WIDTH,
                            height: CANVAS_HEIGHT,
                            background: '#ffffff',
                            cursor: (isRightMouseDown || isSpaceDragging) ? 'grabbing' : tool === 'eraser' ? 'none' : 'default'
                        }}
                    >
                        <Layer>
                            {/* Background Image with Eraser - Cached Group for composite operations */}
                            {mapImage && mapImageVisible && (
                                <Group
                                    ref={imageGroupRef}
                                    name="background-image-group"
                                    x={mapImagePosition.x}
                                    y={mapImagePosition.y}
                                    rotation={mapImageRotation}
                                    draggable={tool === 'select'}
                                    onClick={(e) => {
                                        if (tool === 'select') {
                                            e.cancelBubble = true;
                                            setIsImageSelected(true);
                                            setSelectedElementIds([]);
                                            setSelectedImageIds([]);
                                        }
                                    }}
                                    onTap={(e) => {
                                        if (tool === 'select') {
                                            e.cancelBubble = true;
                                            setIsImageSelected(true);
                                            setSelectedElementIds([]);
                                            setSelectedImageIds([]);
                                        }
                                    }}
                                    onDragMove={(e) => {
                                        // Smart guides for image (like Canva)
                                        if (isCtrlCmdPressedRef.current) {
                                            setSmartGuides({ vertical: [], horizontal: [] });
                                            return;
                                        }

                                        const node = e.target;
                                        const currentX = node.x();
                                        const currentY = node.y();
                                        const imgWidth = mapImageSize.width;
                                        const imgHeight = mapImageSize.height;

                                        // Image bounds (corner-based: x,y is top-left)
                                        const imgLeft = currentX;
                                        const imgRight = currentX + imgWidth;
                                        const imgTop = currentY;
                                        const imgBottom = currentY + imgHeight;
                                        const imgCenterX = currentX + imgWidth / 2;
                                        const imgCenterY = currentY + imgHeight / 2;

                                        const guides: { vertical: number[]; horizontal: number[] } = { vertical: [], horizontal: [] };
                                        let bestSnapX: { value: number; distance: number; type: 'left' | 'right' | 'center' } | null = null;
                                        let bestSnapY: { value: number; distance: number; type: 'top' | 'bottom' | 'center' } | null = null;

                                        const checkSnapX = (edge: number, target: number, type: 'left' | 'right' | 'center', guide: number) => {
                                            const dist = Math.abs(edge - target);
                                            if (dist < SNAP_THRESHOLD) {
                                                if (!bestSnapX || dist < bestSnapX.distance) {
                                                    bestSnapX = { value: target, distance: dist, type };
                                                }
                                                guides.vertical.push(guide);
                                            }
                                        };

                                        const checkSnapY = (edge: number, target: number, type: 'top' | 'bottom' | 'center', guide: number) => {
                                            const dist = Math.abs(edge - target);
                                            if (dist < SNAP_THRESHOLD) {
                                                if (!bestSnapY || dist < bestSnapY.distance) {
                                                    bestSnapY = { value: target, distance: dist, type };
                                                }
                                                guides.horizontal.push(guide);
                                            }
                                        };

                                        // Check canvas edges
                                        checkSnapX(imgLeft, 0, 'left', 0);
                                        checkSnapX(imgRight, 0, 'right', 0);
                                        checkSnapX(imgCenterX, 0, 'center', 0);
                                        checkSnapX(imgLeft, CANVAS_WIDTH / 2, 'left', CANVAS_WIDTH / 2);
                                        checkSnapX(imgRight, CANVAS_WIDTH / 2, 'right', CANVAS_WIDTH / 2);
                                        checkSnapX(imgCenterX, CANVAS_WIDTH / 2, 'center', CANVAS_WIDTH / 2);
                                        checkSnapX(imgLeft, CANVAS_WIDTH, 'left', CANVAS_WIDTH);
                                        checkSnapX(imgRight, CANVAS_WIDTH, 'right', CANVAS_WIDTH);
                                        checkSnapX(imgCenterX, CANVAS_WIDTH, 'center', CANVAS_WIDTH);

                                        checkSnapY(imgTop, 0, 'top', 0);
                                        checkSnapY(imgBottom, 0, 'bottom', 0);
                                        checkSnapY(imgCenterY, 0, 'center', 0);
                                        checkSnapY(imgTop, CANVAS_HEIGHT / 2, 'top', CANVAS_HEIGHT / 2);
                                        checkSnapY(imgBottom, CANVAS_HEIGHT / 2, 'bottom', CANVAS_HEIGHT / 2);
                                        checkSnapY(imgCenterY, CANVAS_HEIGHT / 2, 'center', CANVAS_HEIGHT / 2);
                                        checkSnapY(imgTop, CANVAS_HEIGHT, 'top', CANVAS_HEIGHT);
                                        checkSnapY(imgBottom, CANVAS_HEIGHT, 'bottom', CANVAS_HEIGHT);
                                        checkSnapY(imgCenterY, CANVAS_HEIGHT, 'center', CANVAS_HEIGHT);

                                        // Check against elements
                                        for (const el of elementsRef.current) {
                                            if (!el.visible) continue;
                                            const bounds = getElementBounds(el, el.x, el.y);

                                            checkSnapX(imgLeft, bounds.left, 'left', bounds.left);
                                            checkSnapX(imgRight, bounds.right, 'right', bounds.right);
                                            checkSnapX(imgCenterX, bounds.centerX, 'center', bounds.centerX);
                                            checkSnapX(imgLeft, bounds.right, 'left', bounds.right);
                                            checkSnapX(imgRight, bounds.left, 'right', bounds.left);

                                            checkSnapY(imgTop, bounds.top, 'top', bounds.top);
                                            checkSnapY(imgBottom, bounds.bottom, 'bottom', bounds.bottom);
                                            checkSnapY(imgCenterY, bounds.centerY, 'center', bounds.centerY);
                                            checkSnapY(imgTop, bounds.bottom, 'top', bounds.bottom);
                                            checkSnapY(imgBottom, bounds.top, 'bottom', bounds.top);
                                        }

                                        // Apply magnetic snapping
                                        if (bestSnapX) {
                                            let snapX = currentX;
                                            if (bestSnapX.type === 'left') snapX = bestSnapX.value;
                                            else if (bestSnapX.type === 'right') snapX = bestSnapX.value - imgWidth;
                                            else if (bestSnapX.type === 'center') snapX = bestSnapX.value - imgWidth / 2;
                                            node.x(snapX);
                                        }
                                        if (bestSnapY) {
                                            let snapY = currentY;
                                            if (bestSnapY.type === 'top') snapY = bestSnapY.value;
                                            else if (bestSnapY.type === 'bottom') snapY = bestSnapY.value - imgHeight;
                                            else if (bestSnapY.type === 'center') snapY = bestSnapY.value - imgHeight / 2;
                                            node.y(snapY);
                                        }

                                        guides.vertical = [...new Set(guides.vertical)];
                                        guides.horizontal = [...new Set(guides.horizontal)];
                                        setSmartGuides(guides);
                                    }}
                                    onDragEnd={(e) => {
                                        setMapImagePosition({
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        });
                                        setHasUnsavedChanges(true);
                                        setSmartGuides({ vertical: [], horizontal: [] });
                                    }}
                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();
                                        const newRotation = node.rotation();

                                        // Reset scale
                                        node.scaleX(1);
                                        node.scaleY(1);

                                        setMapImagePosition({
                                            x: node.x(),
                                            y: node.y(),
                                        });
                                        setMapImageSize({
                                            width: Math.max(50, mapImageSize.width * scaleX),
                                            height: Math.max(50, mapImageSize.height * scaleY),
                                        });
                                        setMapImageRotation(newRotation);
                                        setHasUnsavedChanges(true);
                                    }}
                                >
                                    {/* The actual image */}
                                    <KonvaImage
                                        ref={mapImageRef}
                                        name="background-image"
                                        image={mapImage}
                                        width={mapImageSize.width}
                                        height={mapImageSize.height}
                                        opacity={mapImageOpacity}
                                    />

                                    {/* Eraser strokes - use destination-out to actually cut from the image */}
                                    {eraserStrokes.map((stroke, i) => {
                                        const strokeSize = stroke[stroke.length - 1];
                                        const points = stroke.slice(0, -1);
                                        return (
                                            <Line
                                                key={`eraser-stroke-${i}`}
                                                points={points}
                                                stroke="#000000"
                                                strokeWidth={strokeSize}
                                                tension={0.5}
                                                lineCap="round"
                                                lineJoin="round"
                                                globalCompositeOperation="destination-out"
                                                listening={false}
                                            />
                                        );
                                    })}

                                    {/* Current eraser stroke preview */}
                                    {isErasing && currentEraserStroke.length > 0 && (
                                        <Line
                                            points={currentEraserStroke}
                                            stroke="#000000"
                                            strokeWidth={eraserSize}
                                            tension={0.5}
                                            lineCap="round"
                                            lineJoin="round"
                                            globalCompositeOperation="destination-out"
                                            listening={false}
                                        />
                                    )}

                                    {/* Crop Grid Overlay - shown when crop mode is enabled and background image is selected */}
                                    {cropModeEnabled && isImageSelected && (
                                        <Group name="crop-grid-overlay" listening={false}>
                                            {/* 3x3 Rule of Thirds Grid */}
                                            {/* Vertical lines */}
                                            <Line
                                                points={[mapImageSize.width / 3, 0, mapImageSize.width / 3, mapImageSize.height]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            <Line
                                                points={[(mapImageSize.width * 2) / 3, 0, (mapImageSize.width * 2) / 3, mapImageSize.height]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            {/* Horizontal lines */}
                                            <Line
                                                points={[0, mapImageSize.height / 3, mapImageSize.width, mapImageSize.height / 3]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            <Line
                                                points={[0, (mapImageSize.height * 2) / 3, mapImageSize.width, (mapImageSize.height * 2) / 3]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            {/* Center crosshair */}
                                            <Line
                                                points={[mapImageSize.width / 2 - 15, mapImageSize.height / 2, mapImageSize.width / 2 + 15, mapImageSize.height / 2]}
                                                stroke="rgba(255, 255, 255, 0.9)"
                                                strokeWidth={1.5}
                                                listening={false}
                                            />
                                            <Line
                                                points={[mapImageSize.width / 2, mapImageSize.height / 2 - 15, mapImageSize.width / 2, mapImageSize.height / 2 + 15]}
                                                stroke="rgba(255, 255, 255, 0.9)"
                                                strokeWidth={1.5}
                                                listening={false}
                                            />
                                            {/* Border outline */}
                                            <Rect
                                                x={0}
                                                y={0}
                                                width={mapImageSize.width}
                                                height={mapImageSize.height}
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                fill="transparent"
                                                listening={false}
                                            />
                                        </Group>
                                    )}
                                </Group>
                            )}

                            {/* Additional Uploaded Images - Wrapped in cached Groups for eraser support */}
                            {uploadedImages.filter(img => img.visible !== false).map((uploadedImg) => (
                                <Group
                                    key={uploadedImg.id}
                                    id={`image-group-${uploadedImg.id}`}
                                    x={uploadedImg.x}
                                    y={uploadedImg.y}
                                    width={uploadedImg.width}
                                    height={uploadedImg.height}
                                    rotation={uploadedImg.rotation ?? 0}
                                    draggable={tool === 'select'}
                                    ref={(node) => {
                                        // Cache the group when it mounts (required for eraser composite operation)
                                        if (node && uploadedImg.image) {
                                            // Use setTimeout to ensure the image is rendered first
                                            setTimeout(() => {
                                                node.cache();
                                            }, 0);
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (tool === 'select') {
                                            e.cancelBubble = true;
                                            // Support multi-select with Shift key
                                            if (e.evt.shiftKey) {
                                                setSelectedImageIds(prev =>
                                                    prev.includes(uploadedImg.id)
                                                        ? prev.filter(id => id !== uploadedImg.id)
                                                        : [...prev, uploadedImg.id]
                                                );
                                            } else {
                                                setSelectedImageIds([uploadedImg.id]);
                                                setSelectedElementIds([]);
                                            }
                                            setIsImageSelected(false);
                                        }
                                    }}
                                    onTap={(e) => {
                                        if (tool === 'select') {
                                            e.cancelBubble = true;
                                            setSelectedImageIds([uploadedImg.id]);
                                            setSelectedElementIds([]);
                                            setIsImageSelected(false);
                                        }
                                    }}
                                    onDragStart={() => {
                                        // Capture current image state before drag for undo
                                        imageDragStartStateRef.current = JSON.parse(JSON.stringify(
                                            uploadedImagesRef.current.map(img => ({
                                                id: img.id,
                                                url: img.url,
                                                x: img.x,
                                                y: img.y,
                                                width: img.width,
                                                height: img.height,
                                                rotation: img.rotation ?? 0,
                                                opacity: img.opacity ?? 0.9,
                                                eraserStrokes: img.eraserStrokes,
                                            }))
                                        ));
                                    }}
                                    onDragMove={(e) => {
                                        // Smart guides for uploaded images
                                        if (isCtrlCmdPressedRef.current) {
                                            setSmartGuides({ vertical: [], horizontal: [] });
                                            return;
                                        }

                                        const node = e.target;
                                        const currentX = node.x();
                                        const currentY = node.y();
                                        const imgWidth = uploadedImg.width;
                                        const imgHeight = uploadedImg.height;

                                        const imgLeft = currentX;
                                        const imgRight = currentX + imgWidth;
                                        const imgTop = currentY;
                                        const imgBottom = currentY + imgHeight;
                                        const imgCenterX = currentX + imgWidth / 2;
                                        const imgCenterY = currentY + imgHeight / 2;

                                        const guides: { vertical: number[]; horizontal: number[] } = { vertical: [], horizontal: [] };
                                        let bestSnapX: { value: number; distance: number; type: 'left' | 'right' | 'center' } | null = null;
                                        let bestSnapY: { value: number; distance: number; type: 'top' | 'bottom' | 'center' } | null = null;

                                        const checkSnapX = (edge: number, target: number, type: 'left' | 'right' | 'center', guide: number) => {
                                            const dist = Math.abs(edge - target);
                                            if (dist < SNAP_THRESHOLD) {
                                                if (!bestSnapX || dist < bestSnapX.distance) {
                                                    bestSnapX = { value: target, distance: dist, type };
                                                }
                                                guides.vertical.push(guide);
                                            }
                                        };

                                        const checkSnapY = (edge: number, target: number, type: 'top' | 'bottom' | 'center', guide: number) => {
                                            const dist = Math.abs(edge - target);
                                            if (dist < SNAP_THRESHOLD) {
                                                if (!bestSnapY || dist < bestSnapY.distance) {
                                                    bestSnapY = { value: target, distance: dist, type };
                                                }
                                                guides.horizontal.push(guide);
                                            }
                                        };

                                        // Check canvas edges
                                        checkSnapX(imgLeft, 0, 'left', 0);
                                        checkSnapX(imgCenterX, CANVAS_WIDTH / 2, 'center', CANVAS_WIDTH / 2);
                                        checkSnapX(imgRight, CANVAS_WIDTH, 'right', CANVAS_WIDTH);
                                        checkSnapY(imgTop, 0, 'top', 0);
                                        checkSnapY(imgCenterY, CANVAS_HEIGHT / 2, 'center', CANVAS_HEIGHT / 2);
                                        checkSnapY(imgBottom, CANVAS_HEIGHT, 'bottom', CANVAS_HEIGHT);

                                        // Check against elements
                                        for (const el of elementsRef.current) {
                                            if (!el.visible) continue;
                                            const bounds = getElementBounds(el, el.x, el.y);
                                            checkSnapX(imgLeft, bounds.left, 'left', bounds.left);
                                            checkSnapX(imgRight, bounds.right, 'right', bounds.right);
                                            checkSnapX(imgCenterX, bounds.centerX, 'center', bounds.centerX);
                                            checkSnapY(imgTop, bounds.top, 'top', bounds.top);
                                            checkSnapY(imgBottom, bounds.bottom, 'bottom', bounds.bottom);
                                            checkSnapY(imgCenterY, bounds.centerY, 'center', bounds.centerY);
                                        }

                                        // Apply magnetic snapping
                                        if (bestSnapX) {
                                            let snapX = currentX;
                                            if (bestSnapX.type === 'left') snapX = bestSnapX.value;
                                            else if (bestSnapX.type === 'right') snapX = bestSnapX.value - imgWidth;
                                            else if (bestSnapX.type === 'center') snapX = bestSnapX.value - imgWidth / 2;
                                            node.x(snapX);
                                        }
                                        if (bestSnapY) {
                                            let snapY = currentY;
                                            if (bestSnapY.type === 'top') snapY = bestSnapY.value;
                                            else if (bestSnapY.type === 'bottom') snapY = bestSnapY.value - imgHeight;
                                            else if (bestSnapY.type === 'center') snapY = bestSnapY.value - imgHeight / 2;
                                            node.y(snapY);
                                        }

                                        guides.vertical = [...new Set(guides.vertical)];
                                        guides.horizontal = [...new Set(guides.horizontal)];
                                        setSmartGuides(guides);
                                    }}
                                    onDragEnd={(e) => {
                                        // Calculate new state
                                        const newImages = uploadedImagesRef.current.map(img =>
                                            img.id === uploadedImg.id
                                                ? { ...img, x: e.target.x(), y: e.target.y() }
                                                : img
                                        );

                                        // Save to history before updating state
                                        if (imageDragStartStateRef.current) {
                                            const previousImages = imageDragStartStateRef.current;
                                            const afterImages = newImages.map(img => ({
                                                id: img.id,
                                                url: img.url,
                                                x: img.x,
                                                y: img.y,
                                                width: img.width,
                                                height: img.height,
                                                rotation: img.rotation ?? 0,
                                                opacity: img.opacity ?? 0.9,
                                                eraserStrokes: img.eraserStrokes,
                                            }));
                                            saveImagesToHistory(previousImages as any, afterImages as any);
                                            imageDragStartStateRef.current = null;
                                        }

                                        setUploadedImages(newImages);
                                        setHasUnsavedChanges(true);
                                        setSmartGuides({ vertical: [], horizontal: [] });
                                    }}
                                    onTransformStart={() => {
                                        // Capture current image state before transform for undo
                                        imageDragStartStateRef.current = JSON.parse(JSON.stringify(
                                            uploadedImagesRef.current.map(img => ({
                                                id: img.id,
                                                url: img.url,
                                                x: img.x,
                                                y: img.y,
                                                width: img.width,
                                                height: img.height,
                                                rotation: img.rotation ?? 0,
                                                opacity: img.opacity ?? 0.9,
                                                eraserStrokes: img.eraserStrokes,
                                            }))
                                        ));
                                    }}
                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();
                                        const newRotation = node.rotation();
                                        node.scaleX(1);
                                        node.scaleY(1);

                                        // Calculate new state including rotation
                                        const newImages = uploadedImagesRef.current.map(img =>
                                            img.id === uploadedImg.id
                                                ? {
                                                    ...img,
                                                    x: node.x(),
                                                    y: node.y(),
                                                    width: Math.max(20, img.width * scaleX),
                                                    height: Math.max(20, img.height * scaleY),
                                                    rotation: newRotation,
                                                }
                                                : img
                                        );

                                        // Save to history before updating state
                                        if (imageDragStartStateRef.current) {
                                            const previousImages = imageDragStartStateRef.current;
                                            const afterImages = newImages.map(img => ({
                                                id: img.id,
                                                url: img.url,
                                                x: img.x,
                                                y: img.y,
                                                width: img.width,
                                                height: img.height,
                                                rotation: img.rotation ?? 0,
                                                opacity: img.opacity ?? 0.9,
                                                eraserStrokes: img.eraserStrokes,
                                            }));
                                            saveImagesToHistory(previousImages as any, afterImages as any);
                                            imageDragStartStateRef.current = null;
                                        }

                                        setUploadedImages(newImages);
                                        setHasUnsavedChanges(true);
                                    }}
                                >
                                    {/* The actual image */}
                                    <KonvaImage
                                        id={uploadedImg.id}
                                        image={uploadedImg.image}
                                        width={uploadedImg.width}
                                        height={uploadedImg.height}
                                        opacity={uploadedImg.opacity ?? 0.9}
                                    />

                                    {/* Eraser strokes - use destination-out to cut from the image */}
                                    {uploadedImg.eraserStrokes.map((stroke, i) => {
                                        const strokeSize = stroke[stroke.length - 1];
                                        const points = stroke.slice(0, -1);
                                        return (
                                            <Line
                                                key={`eraser-stroke-${uploadedImg.id}-${i}`}
                                                points={points}
                                                stroke="#000000"
                                                strokeWidth={strokeSize}
                                                tension={0.5}
                                                lineCap="round"
                                                lineJoin="round"
                                                globalCompositeOperation="destination-out"
                                                listening={false}
                                            />
                                        );
                                    })}

                                    {/* Current eraser stroke preview for this image */}
                                    {isErasing && erasingImageId === uploadedImg.id && currentEraserStroke.length > 0 && (
                                        <Line
                                            points={currentEraserStroke}
                                            stroke="#000000"
                                            strokeWidth={eraserSize}
                                            tension={0.5}
                                            lineCap="round"
                                            lineJoin="round"
                                            globalCompositeOperation="destination-out"
                                            listening={false}
                                        />
                                    )}

                                    {/* Crop Grid Overlay - shown when crop mode is enabled and image is selected */}
                                    {cropModeEnabled && selectedImageIds.includes(uploadedImg.id) && (
                                        <Group name="crop-grid-overlay" listening={false}>
                                            {/* 3x3 Rule of Thirds Grid */}
                                            {/* Vertical lines */}
                                            <Line
                                                points={[uploadedImg.width / 3, 0, uploadedImg.width / 3, uploadedImg.height]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            <Line
                                                points={[(uploadedImg.width * 2) / 3, 0, (uploadedImg.width * 2) / 3, uploadedImg.height]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            {/* Horizontal lines */}
                                            <Line
                                                points={[0, uploadedImg.height / 3, uploadedImg.width, uploadedImg.height / 3]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            <Line
                                                points={[0, (uploadedImg.height * 2) / 3, uploadedImg.width, (uploadedImg.height * 2) / 3]}
                                                stroke="rgba(255, 255, 255, 0.7)"
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            {/* Center crosshair */}
                                            <Line
                                                points={[uploadedImg.width / 2 - 10, uploadedImg.height / 2, uploadedImg.width / 2 + 10, uploadedImg.height / 2]}
                                                stroke="rgba(255, 255, 255, 0.9)"
                                                strokeWidth={1.5}
                                                listening={false}
                                            />
                                            <Line
                                                points={[uploadedImg.width / 2, uploadedImg.height / 2 - 10, uploadedImg.width / 2, uploadedImg.height / 2 + 10]}
                                                stroke="rgba(255, 255, 255, 0.9)"
                                                strokeWidth={1.5}
                                                listening={false}
                                            />
                                            {/* Border outline */}
                                            <Rect
                                                x={0}
                                                y={0}
                                                width={uploadedImg.width}
                                                height={uploadedImg.height}
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fill="transparent"
                                                listening={false}
                                            />
                                        </Group>
                                    )}
                                </Group>
                            ))}

                            {/* Grid lines - rendered AFTER eraser strokes so they're visible */}
                            {showGrid && (
                                <Group name="grid-group-overlay" listening={false}>
                                    {/* Vertical grid lines */}
                                    {Array.from({ length: Math.ceil(CANVAS_WIDTH / 50) + 1 }).map((_, i) => (
                                        <Line
                                            key={`v-overlay-${i}`}
                                            name="grid-line"
                                            points={[i * 50, 0, i * 50, CANVAS_HEIGHT]}
                                            stroke="#9ca3af"
                                            strokeWidth={0.75}
                                            listening={false}
                                        />
                                    ))}
                                    {/* Horizontal grid lines */}
                                    {Array.from({ length: Math.ceil(CANVAS_HEIGHT / 50) + 1 }).map((_, i) => (
                                        <Line
                                            key={`h-overlay-${i}`}
                                            name="grid-line"
                                            points={[0, i * 50, CANVAS_WIDTH, i * 50]}
                                            stroke="#9ca3af"
                                            strokeWidth={0.75}
                                            listening={false}
                                        />
                                    ))}
                                </Group>
                            )}

                            {/* Eraser cursor preview - dashed circle following the mouse */}
                            {tool === 'eraser' && eraserCursorPos && (
                                <Circle
                                    x={eraserCursorPos.x}
                                    y={eraserCursorPos.y}
                                    radius={eraserSize / 2}
                                    stroke="#000000"
                                    strokeWidth={1.5}
                                    dash={[4, 4]}
                                    listening={false}
                                />
                            )}

                            {/* Elements - sorted by zIndex so higher values render on top */}
                            {[...elements].sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}

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
                                const dragOffset = lineArrowDragOffsetRef.current;

                                return (
                                    <Group>
                                        {/* Start point anchor */}
                                        <Circle
                                            x={points[0] + dragOffset.x}
                                            y={points[1] + dragOffset.y}
                                            radius={8}
                                            fill="#3b82f6"
                                            stroke="#1d4ed8"
                                            strokeWidth={2}
                                            draggable={true}
                                            onDragMove={(e) => {
                                                const newPoints = [...points];
                                                let newX = e.target.x() - dragOffset.x;
                                                let newY = e.target.y() - dragOffset.y;

                                                // When Shift is held, constrain to horizontal or vertical
                                                if (isShiftPressedRef.current) {
                                                    const otherX = points[2];
                                                    const otherY = points[3];
                                                    const deltaX = Math.abs(newX - otherX);
                                                    const deltaY = Math.abs(newY - otherY);

                                                    if (deltaX > deltaY) {
                                                        // Horizontal line - constrain Y to other point's Y
                                                        newY = otherY;
                                                    } else {
                                                        // Vertical line - constrain X to other point's X
                                                        newX = otherX;
                                                    }
                                                    e.target.x(newX + dragOffset.x);
                                                    e.target.y(newY + dragOffset.y);
                                                }

                                                newPoints[0] = newX;
                                                newPoints[1] = newY;
                                                updateElement(selectedElementIds[0], { points: newPoints });
                                            }}
                                        />
                                        {/* End point anchor */}
                                        <Circle
                                            x={points[2] + dragOffset.x}
                                            y={points[3] + dragOffset.y}
                                            radius={8}
                                            fill="#3b82f6"
                                            stroke="#1d4ed8"
                                            strokeWidth={2}
                                            draggable={true}
                                            onDragMove={(e) => {
                                                const newPoints = [...points];
                                                let newX = e.target.x() - dragOffset.x;
                                                let newY = e.target.y() - dragOffset.y;

                                                // When Shift is held, constrain to horizontal or vertical
                                                if (isShiftPressedRef.current) {
                                                    const otherX = points[0];
                                                    const otherY = points[1];
                                                    const deltaX = Math.abs(newX - otherX);
                                                    const deltaY = Math.abs(newY - otherY);

                                                    if (deltaX > deltaY) {
                                                        // Horizontal line - constrain Y to other point's Y
                                                        newY = otherY;
                                                    } else {
                                                        // Vertical line - constrain X to other point's X
                                                        newX = otherX;
                                                    }
                                                    e.target.x(newX + dragOffset.x);
                                                    e.target.y(newY + dragOffset.y);
                                                }

                                                newPoints[2] = newX;
                                                newPoints[3] = newY;
                                                updateElement(selectedElementIds[0], { points: newPoints });
                                            }}
                                        />
                                    </Group>
                                );
                            })()}

                            {/* Smart Guides - alignment lines */}
                            {(smartGuides.vertical.length > 0 || smartGuides.horizontal.length > 0) && (
                                <Group name="smart-guides" listening={false}>
                                    {/* Vertical guides (for X alignment) */}
                                    {smartGuides.vertical.map((x, i) => (
                                        <Line
                                            key={`v-guide-${i}`}
                                            points={[x, 0, x, CANVAS_HEIGHT]}
                                            stroke="#f43f5e"
                                            strokeWidth={1}
                                            dash={[4, 4]}
                                            listening={false}
                                        />
                                    ))}
                                    {/* Horizontal guides (for Y alignment) */}
                                    {smartGuides.horizontal.map((y, i) => (
                                        <Line
                                            key={`h-guide-${i}`}
                                            points={[0, y, CANVAS_WIDTH, y]}
                                            stroke="#f43f5e"
                                            strokeWidth={1}
                                            dash={[4, 4]}
                                            listening={false}
                                        />
                                    ))}
                                </Group>
                            )}

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

                            {/* Capture Area Boundary - rendered AFTER all elements so it's always visible on top */}
                            {showCaptureArea && (
                                <Group name="capture-area-group" listening={false}>
                                    {/* Semi-transparent overlay outside capture area to dim out-of-bounds */}
                                    {/* Top overlay */}
                                    <Rect
                                        x={-2000}
                                        y={-2000}
                                        width={4000 + CANVAS_WIDTH}
                                        height={2000}
                                        fill="rgba(0, 0, 0, 0.3)"
                                        listening={false}
                                    />
                                    {/* Bottom overlay */}
                                    <Rect
                                        x={-2000}
                                        y={CANVAS_HEIGHT}
                                        width={4000 + CANVAS_WIDTH}
                                        height={2000}
                                        fill="rgba(0, 0, 0, 0.3)"
                                        listening={false}
                                    />
                                    {/* Left overlay */}
                                    <Rect
                                        x={-2000}
                                        y={0}
                                        width={2000}
                                        height={CANVAS_HEIGHT}
                                        fill="rgba(0, 0, 0, 0.3)"
                                        listening={false}
                                    />
                                    {/* Right overlay */}
                                    <Rect
                                        x={CANVAS_WIDTH}
                                        y={0}
                                        width={2000}
                                        height={CANVAS_HEIGHT}
                                        fill="rgba(0, 0, 0, 0.3)"
                                        listening={false}
                                    />

                                    {/* Dashed border showing what will be captured */}
                                    <Rect
                                        name="capture-boundary"
                                        x={0}
                                        y={0}
                                        width={CANVAS_WIDTH}
                                        height={CANVAS_HEIGHT}
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fill="transparent"
                                        listening={false}
                                        dash={[10, 6]}
                                    />
                                    {/* Corner markers for emphasis */}
                                    <Line points={[0, 30, 0, 0, 30, 0]} stroke="#3b82f6" strokeWidth={4} listening={false} />
                                    <Line points={[CANVAS_WIDTH - 30, 0, CANVAS_WIDTH, 0, CANVAS_WIDTH, 30]} stroke="#3b82f6" strokeWidth={4} listening={false} />
                                    <Line points={[0, CANVAS_HEIGHT - 30, 0, CANVAS_HEIGHT, 30, CANVAS_HEIGHT]} stroke="#3b82f6" strokeWidth={4} listening={false} />
                                    <Line points={[CANVAS_WIDTH - 30, CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - 30]} stroke="#3b82f6" strokeWidth={4} listening={false} />
                                </Group>
                            )}

                            {/* Crop Box - shown when crop mode is enabled */}
                            {cropModeEnabled && cropBox && (
                                <Rect
                                    ref={cropBoxRef}
                                    name="crop-box"
                                    x={cropBox.x}
                                    y={cropBox.y}
                                    width={cropBox.width}
                                    height={cropBox.height}
                                    fill="rgba(59, 130, 246, 0.15)"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dash={[8, 4]}
                                    draggable
                                    onClick={(e) => {
                                        // Stop propagation to prevent deselection
                                        e.cancelBubble = true;
                                    }}
                                    onTap={(e) => {
                                        // Stop propagation to prevent deselection on touch
                                        e.cancelBubble = true;
                                    }}
                                    onDragEnd={(e) => {
                                        setCropBox(prev => prev ? {
                                            ...prev,
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        } : null);
                                    }}
                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();
                                        node.scaleX(1);
                                        node.scaleY(1);
                                        setCropBox(prev => prev ? {
                                            ...prev,
                                            x: node.x(),
                                            y: node.y(),
                                            width: Math.max(20, prev.width * scaleX),
                                            height: Math.max(20, prev.height * scaleY),
                                        } : null);
                                    }}
                                />
                            )}

                            {/* Crop Box Transformer */}
                            {cropModeEnabled && cropBox && (
                                <Transformer
                                    ref={cropBoxTransformerRef}
                                    nodes={cropBoxRef.current ? [cropBoxRef.current] : []}
                                    anchorSize={8}
                                    anchorCornerRadius={2}
                                    borderStroke="#3b82f6"
                                    borderStrokeWidth={2}
                                    anchorFill="#ffffff"
                                    anchorStroke="#3b82f6"
                                    rotateEnabled={false}
                                    keepRatio={false}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < 20 || newBox.height < 20) {
                                            return oldBox;
                                        }
                                        return newBox;
                                    }}
                                />
                            )}

                            {/* Transformer */}
                            <Transformer
                                ref={transformerRef}
                                anchorSize={6}
                                anchorCornerRadius={2}
                                borderStrokeWidth={1}
                                rotateAnchorOffset={15}
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

                            {/* Image Transformer */}
                            <Transformer
                                ref={imageTransformerRef}
                                anchorSize={8}
                                anchorCornerRadius={2}
                                borderStroke="#3b82f6"
                                borderStrokeWidth={2}
                                anchorStroke="#3b82f6"
                                anchorFill="#ffffff"
                                rotateEnabled={false}
                                keepRatio={false}
                                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (newBox.width < 50 || newBox.height < 50) {
                                        return oldBox;
                                    }
                                    return newBox;
                                }}
                            />

                            {/* Uploaded Images Transformer */}
                            <Transformer
                                ref={uploadedImageTransformerRef}
                                anchorSize={8}
                                anchorCornerRadius={2}
                                borderStroke="#10b981"
                                borderStrokeWidth={2}
                                anchorStroke="#10b981"
                                anchorFill="#ffffff"
                                rotateEnabled={true}
                                keepRatio={false}
                                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (newBox.width < 20 || newBox.height < 20) {
                                        return oldBox;
                                    }
                                    return newBox;
                                }}
                            />
                        </Layer>
                    </Stage>

                    {/* Right-click Context Menu */}
                    {contextMenu?.visible && (
                        <div
                            className="absolute bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {contextMenu.isOnCanvas ? (
                                // Empty canvas - only show Paste if we have copied elements
                                copiedElements.length > 0 && (
                                    <button
                                        onClick={() => { handlePaste(); setContextMenu(null); }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Ctrl+V</span>
                                        Paste
                                    </button>
                                )
                            ) : (
                                // On element - show full menu
                                <>
                                    <button
                                        onClick={() => { handleCut(); setContextMenu(null); }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Ctrl+X</span>
                                        Cut
                                    </button>
                                    <button
                                        onClick={() => { handleCopy(); setContextMenu(null); }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Ctrl+C</span>
                                        Copy
                                    </button>
                                    <button
                                        onClick={() => { handlePaste(); setContextMenu(null); }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                                        disabled={copiedElements.length === 0}
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Ctrl+V</span>
                                        Paste
                                    </button>
                                    <button
                                        onClick={() => { handleDuplicate(); setContextMenu(null); }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Ctrl+D</span>
                                        Duplicate
                                    </button>
                                    <div className="border-t border-border my-1" />
                                    <button
                                        onClick={() => {
                                            if (contextMenu.targetElementId) {
                                                handleDeleteElement(contextMenu.targetElementId);
                                            }
                                            setContextMenu(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 text-destructive"
                                    >
                                        <span className="text-muted-foreground text-xs w-12">Del</span>
                                        Delete
                                    </button>
                                    <div className="border-t border-border my-1" />
                                    <button
                                        onClick={handleBringForward}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                                        disabled={selectedElementIds.length !== 1}
                                    >
                                        Bring Forward
                                    </button>
                                    <button
                                        onClick={handleSendBackward}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                                        disabled={selectedElementIds.length !== 1}
                                    >
                                        Send Backward
                                    </button>
                                    <button
                                        onClick={handleBringToFront}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                                        disabled={selectedElementIds.length !== 1}
                                    >
                                        Bring to Front
                                    </button>
                                    <button
                                        onClick={handleSendToBack}
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                                        disabled={selectedElementIds.length !== 1}
                                    >
                                        Send to Back
                                    </button>
                                </>
                            )}
                        </div>
                    )}

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
                                left: editingLabelPosition.x,
                                top: editingLabelPosition.y,
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

                    {/* Label Edit Input (for element labels) */}
                    {editingLabelId && (() => {
                        const editingElement = elements.find(el => el.id === editingLabelId);
                        const isStaticPin = editingElement?.type === 'static-pin';
                        const isDevicePin = editingElement?.type === 'device-pin';
                        const isTextElement = editingElement?.type === 'text';

                        // Determine styling based on element type:
                        // - static-pin/device-pin: use pin's label styling
                        // - text: use text element's styling
                        // - other shapes: use label settings
                        let textColor: string;
                        let fontSize: number;
                        let fontWeight: string;
                        let fontFamily: string;

                        if (isStaticPin || isDevicePin) {
                            textColor = editingElement?.pinLabelColor || '#ffffff';
                            fontSize = (editingElement?.pinLabelFontSize || (isDevicePin ? 14 : 16)) * scale;
                            fontWeight = editingElement?.pinLabelFontWeight || 'normal';
                            fontFamily = editingElement?.pinLabelFontFamily || 'Inter, system-ui, -apple-system, sans-serif';
                        } else if (isTextElement) {
                            textColor = editingElement?.fillColor || '#3b82f6';
                            fontSize = (editingElement?.fontSize || 24) * scale;
                            fontWeight = editingElement?.fontWeight || 'normal';
                            fontFamily = editingElement?.fontFamily || 'Arial';
                        } else {
                            textColor = editingElement?.labelColor || '#000000';
                            fontSize = (editingElement?.labelFontSize || 28) * scale;
                            fontWeight = editingElement?.labelFontWeight || 'normal';
                            fontFamily = 'Arial, sans-serif';
                        }

                        return (
                            <div
                                className="absolute z-50 pointer-events-auto"
                                style={{
                                    left: editingLabelPosition.x,
                                    top: editingLabelPosition.y,
                                    transform: 'translate(-50%, -50%)',
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <input
                                    ref={labelEditInputRef}
                                    value={editingLabelValue}
                                    onChange={(e) => setEditingLabelValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            finishLabelEdit(true);
                                        }
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            finishLabelEdit(false);
                                        }
                                    }}
                                    className="border-none text-center outline-none focus:outline-none focus:ring-0 min-w-[60px]"
                                    style={{
                                        color: textColor,
                                        caretColor: textColor,
                                        fontSize: `${fontSize}px`,
                                        fontWeight: fontWeight,
                                        backgroundColor: 'transparent',
                                        lineHeight: 1.2,
                                        fontFamily: fontFamily,
                                    }}
                                    placeholder=""
                                />
                            </div>
                        );
                    })()}
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
                            <TabsTrigger
                                value="history"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                                History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="properties" className="flex-1 m-0 overflow-hidden">
                            <PropertiesPanel
                                element={selectedElement}
                                elements={elements}
                                onUpdateElement={updateElement}
                                activeTool={tool}
                                eraserSize={eraserSize}
                                onEraserSizeChange={setEraserSize}
                                onClearEraserStrokes={() => {
                                    // Clear legacy mapImage eraser strokes
                                    setEraserStrokes([]);
                                    // Clear all uploaded images' eraser strokes
                                    setUploadedImages(prev => prev.map(img => ({
                                        ...img,
                                        eraserStrokes: []
                                    })));
                                    // Note: Clear is not undoable for simplicity
                                }}
                                hasEraserStrokes={eraserStrokes.length > 0 || uploadedImages.some(img => img.eraserStrokes.length > 0)}
                                onFlipHorizontal={handleFlipHorizontal}
                                onFlipVertical={handleFlipVertical}
                                // Image properties
                                selectedImageIds={selectedImageIds}
                                uploadedImages={uploadedImages.map(img => ({
                                    id: img.id,
                                    url: img.url,
                                    x: img.x,
                                    y: img.y,
                                    width: img.width,
                                    height: img.height,
                                    rotation: img.rotation ?? 0,
                                    opacity: img.opacity ?? 0.9,
                                    eraserStrokes: img.eraserStrokes,
                                }))}
                                onUpdateImage={handleUpdateImage}
                                isBackgroundImageSelected={isImageSelected}
                                backgroundImagePosition={mapImagePosition}
                                backgroundImageSize={mapImageSize}
                                backgroundImageRotation={mapImageRotation}
                                backgroundImageOpacity={mapImageOpacity}
                                onUpdateBackgroundImage={handleUpdateBackgroundImage}
                                cropModeEnabled={cropModeEnabled}
                                onCropModeChange={(enabled) => {
                                    setCropModeEnabled(enabled);
                                    if (enabled) {
                                        // Initialize crop box for currently selected image
                                        if (isImageSelected) {
                                            initializeCropBox('background');
                                        } else if (selectedImageIds.length === 1) {
                                            initializeCropBox(selectedImageIds[0]);
                                        }
                                    } else {
                                        setCropBox(null);
                                    }
                                }}
                                onApplyCrop={handleApplyCrop}
                                cropBox={cropBox}
                            />
                        </TabsContent>

                        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden">
                            <LayersPanel
                                elements={elements}
                                selectedId={selectedElementIds.length > 0 ? selectedElementIds[0] : null}
                                onSelect={(id) => {
                                    setSelectedElementIds(id ? [id] : []);
                                    setSelectedImageIds([]);
                                    setIsImageSelected(false);
                                }}
                                onToggleVisibility={handleToggleVisibility}
                                onToggleLock={handleToggleLock}
                                onReorder={handleReorderElements}
                                onNameElement={(id, name) => {
                                    // Directly update the element's name (inline editing in LayersPanel)
                                    updateElement(id, { name });
                                }}
                                // Image layer props
                                uploadedImages={uploadedImages.map(img => ({
                                    id: img.id,
                                    url: img.url,
                                    x: img.x,
                                    y: img.y,
                                    width: img.width,
                                    height: img.height,
                                    visible: img.visible,
                                }))}
                                selectedImageIds={selectedImageIds}
                                onSelectImage={handleSelectImageFromLayers}
                                onToggleImageVisibility={handleToggleImageVisibility}
                                onDeleteImage={handleDeleteImageFromLayers}
                                // Background image props
                                hasBackgroundImage={!!mapImage}
                                isBackgroundSelected={isImageSelected}
                                onSelectBackground={handleSelectBackgroundFromLayers}
                                backgroundImageVisible={mapImageVisible}
                                onToggleBackgroundVisibility={handleToggleBackgroundVisibility}
                            />
                        </TabsContent>

                        <TabsContent value="links" className="flex-1 m-0 overflow-hidden">
                            <LinksPanel
                                element={selectedElement}
                                storeId={storeId}
                                onLinksChanged={() => setHasLinkChanges(true)}
                            />
                        </TabsContent>

                        <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
                            <HistoryPanel
                                history={elementHistory}
                                onPlaceElement={placeElementFromHistory}
                                onClearHistory={clearElementHistory}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Preview Modal */}
            <PreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                storeId={storeId}
                elements={elements}
                mapImageUrl={mapImageUrl}
                uploadedImages={uploadedImages}
            />
        </div>
    );
};

export default MapEditor;
