import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { Gradient, GradientStop } from './types';

interface GradientEditorProps {
  gradient: Gradient | undefined;
  fillColor: string;
  onChange: (gradient: Gradient) => void;
}

const defaultGradient: Gradient = {
  type: 'solid',
  angle: 0,
  stops: [
    { position: 0, color: '#3b82f6' },
    { position: 100, color: '#1d4ed8' },
  ],
};

const GradientEditor = ({ gradient, fillColor = '#3b82f6', onChange }: GradientEditorProps) => {
  // Ensure we always have a valid gradient with stops
  const currentGradient: Gradient = gradient && gradient.type ? {
    type: gradient.type,
    angle: gradient.angle || 0,
    stops: gradient.stops && gradient.stops.length >= 2 ? gradient.stops : [
      { position: 0, color: fillColor },
      { position: 100, color: '#ffffff' },
    ],
  } : {
    type: 'solid',
    angle: 0,
    stops: [
      { position: 0, color: fillColor },
      { position: 100, color: '#ffffff' },
    ],
  };

  const handleTypeChange = (type: 'solid' | 'linear' | 'radial') => {
    if (type === 'solid') {
      onChange({ type: 'solid' });
    } else {
      onChange({
        ...currentGradient,
        type,
        stops: currentGradient.stops || [
          { position: 0, color: fillColor },
          { position: 100, color: '#ffffff' },
        ],
      });
    }
  };

  const handleAngleChange = (angle: number) => {
    onChange({
      ...currentGradient,
      angle,
    });
  };

  const handleStopColorChange = (index: number, color: string) => {
    const newStops = [...(currentGradient.stops || [])];
    newStops[index] = { ...newStops[index], color };
    onChange({
      ...currentGradient,
      stops: newStops,
    });
  };

  const handleStopPositionChange = (index: number, position: number) => {
    const newStops = [...(currentGradient.stops || [])];
    newStops[index] = { ...newStops[index], position };
    // Sort by position
    newStops.sort((a, b) => a.position - b.position);
    onChange({
      ...currentGradient,
      stops: newStops,
    });
  };

  const addStop = () => {
    const stops = currentGradient.stops || [];
    if (stops.length >= 5) return; // Max 5 stops

    // Find a position between existing stops
    const midPosition = stops.length > 1
      ? (stops[0].position + stops[stops.length - 1].position) / 2
      : 50;

    const newStops = [
      ...stops,
      { position: midPosition, color: '#888888' },
    ].sort((a, b) => a.position - b.position);

    onChange({
      ...currentGradient,
      stops: newStops,
    });
  };

  const removeStop = (index: number) => {
    const stops = currentGradient.stops || [];
    if (stops.length <= 2) return; // Minimum 2 stops

    const newStops = stops.filter((_, i) => i !== index);
    onChange({
      ...currentGradient,
      stops: newStops,
    });
  };

  // Generate preview gradient CSS
  const getPreviewGradient = () => {
    if (currentGradient.type === 'solid' || !currentGradient.stops || currentGradient.stops.length < 2) {
      return fillColor || '#3b82f6';
    }

    try {
      const stopsStr = currentGradient.stops
        .map(s => `${s.color || '#888888'} ${s.position || 0}%`)
        .join(', ');

      if (currentGradient.type === 'linear') {
        return `linear-gradient(${currentGradient.angle || 0}deg, ${stopsStr})`;
      } else {
        return `radial-gradient(circle, ${stopsStr})`;
      }
    } catch {
      return fillColor || '#3b82f6';
    }
  };

  return (
    <div className="space-y-3">
      {/* Gradient Type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Fill Type</Label>
        <Select
          value={currentGradient.type}
          onValueChange={(value) => handleTypeChange(value as 'solid' | 'linear' | 'radial')}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="linear">Linear Gradient</SelectItem>
            <SelectItem value="radial">Radial Gradient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      {(currentGradient.type === 'linear' || currentGradient.type === 'radial') && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Preview</Label>
            <div
              className="h-8 rounded border border-border"
              style={{ background: getPreviewGradient() }}
            />
          </div>

          {/* Angle (for linear) */}
          {currentGradient.type === 'linear' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Angle: {currentGradient.angle || 0}°</Label>
              <Slider
                value={[currentGradient.angle || 0]}
                onValueChange={([value]) => handleAngleChange(value)}
                min={0}
                max={360}
                step={15}
              />
            </div>
          )}

          {/* Color Stops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Color Stops</Label>
              {(currentGradient.stops?.length || 0) < 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={addStop}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {currentGradient.stops?.map((stop, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="color"
                  value={stop.color}
                  onChange={(e) => handleStopColorChange(index, e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
                <div className="flex-1">
                  <Slider
                    value={[stop.position]}
                    onValueChange={([value]) => handleStopPositionChange(index, value)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8">{stop.position}%</span>
                {(currentGradient.stops?.length || 0) > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeStop(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GradientEditor;

// Helper function to convert gradient config to Konva props
export const getGradientProps = (element: { gradient?: Gradient; fillColor: string; width?: number; height?: number }) => {
  // Safety check - return solid fill if element doesn't have valid dimensions
  if (!element || !element.fillColor) {
    return { fill: '#3b82f6' }; // Default blue
  }

  if (!element.gradient || element.gradient.type === 'solid' || !element.gradient.stops || element.gradient.stops.length < 2) {
    return { fill: element.fillColor };
  }

  // Ensure we have valid dimensions
  const width = element.width || 100;
  const height = element.height || 100;

  const { type, angle = 0, stops } = element.gradient;

  try {
    if (type === 'linear') {
      // Convert angle to start/end points
      const angleRad = (angle * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      // Calculate gradient line endpoints based on element dimensions
      const halfWidth = width / 2;
      const halfHeight = height / 2;

      return {
        fillLinearGradientStartPoint: {
          x: halfWidth - cos * halfWidth,
          y: halfHeight - sin * halfHeight,
        },
        fillLinearGradientEndPoint: {
          x: halfWidth + cos * halfWidth,
          y: halfHeight + sin * halfHeight,
        },
        fillLinearGradientColorStops: stops.flatMap(s => [s.position / 100, s.color]),
      };
    } else if (type === 'radial') {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.max(width, height) / 2;

      return {
        fillRadialGradientStartPoint: { x: centerX, y: centerY },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndPoint: { x: centerX, y: centerY },
        fillRadialGradientEndRadius: radius,
        fillRadialGradientColorStops: stops.flatMap(s => [s.position / 100, s.color]),
      };
    }
  } catch (error) {
    console.error('Error calculating gradient props:', error);
  }

  return { fill: element.fillColor };
};
