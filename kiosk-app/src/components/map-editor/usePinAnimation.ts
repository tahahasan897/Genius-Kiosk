import { useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import type { AnimationStyle } from './types';

interface AnimationConfig {
  duration: number;
  properties: Record<string, number>;
  easing: (t: number, b: number, c: number, d: number) => number;
}

/**
 * Get animation configuration based on animation style
 * @param style - Animation style (1-5)
 * @param baseY - Base Y position for bounce animation
 * @param motionScale - Speed multiplier (0.25 = slow, 1 = normal, 3 = fast)
 */
const getAnimationConfig = (style: AnimationStyle, baseY: number = 0, motionScale: number = 1): AnimationConfig => {
  // Apply motion scale to duration (higher motionScale = faster = shorter duration)
  const scaleDuration = (baseDuration: number) => baseDuration / Math.max(0.25, Math.min(3, motionScale));

  switch (style) {
    case 1: // Pulse
      return {
        duration: scaleDuration(0.6),
        properties: { scaleX: 1.15, scaleY: 1.15, opacity: 0.8 },
        easing: Konva.Easings.EaseInOut,
      };
    case 2: // Bounce
      return {
        duration: scaleDuration(0.5),
        properties: { y: baseY - 10 },
        easing: Konva.Easings.BounceEaseOut,
      };
    case 3: // Ripple (simulate with opacity pulse)
      return {
        duration: scaleDuration(1),
        properties: { opacity: 0.5 },
        easing: Konva.Easings.EaseOut,
      };
    case 4: // Flash
      return {
        duration: scaleDuration(0.3),
        properties: { opacity: 0.3 },
        easing: Konva.Easings.Linear,
      };
    case 5: // Glow (simulate with scale)
      return {
        duration: scaleDuration(0.8),
        properties: { scaleX: 1.08, scaleY: 1.08 },
        easing: Konva.Easings.EaseInOut,
      };
    default:
      return getAnimationConfig(1, baseY, motionScale);
  }
};

/**
 * Hook to animate a Konva node with pin animations
 * @param nodeRef - Reference to the Konva node to animate
 * @param animationStyle - The animation style (1-5)
 * @param continuous - Whether to loop the animation continuously
 * @param trigger - Optional trigger to play one-time animation
 * @param motionScale - Animation speed multiplier (0.25 = slow, 1 = normal, 3 = fast)
 */
export const usePinAnimation = (
  nodeRef: React.RefObject<Konva.Node | null>,
  animationStyle: AnimationStyle,
  continuous: boolean = false,
  trigger?: number, // Increment to trigger a one-time animation
  motionScale: number = 1 // Animation speed multiplier
) => {
  const tweenRef = useRef<Konva.Tween | null>(null);
  const reverseTweenRef = useRef<Konva.Tween | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const cleanup = useCallback(() => {
    if (tweenRef.current) {
      tweenRef.current.destroy();
      tweenRef.current = null;
    }
    if (reverseTweenRef.current) {
      reverseTweenRef.current.destroy();
      reverseTweenRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  const runAnimation = useCallback(() => {
    const node = nodeRef.current;
    // Don't animate if style is 0 (Set animation - no animation)
    if (!node || isRunningRef.current || animationStyle === 0) return;

    isRunningRef.current = true;

    const originalProps = {
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      opacity: node.opacity(),
      y: node.y(),
    };

    const config = getAnimationConfig(animationStyle, originalProps.y, motionScale);

    // Create forward animation
    tweenRef.current = new Konva.Tween({
      node,
      duration: config.duration,
      easing: config.easing,
      ...config.properties,
      onFinish: () => {
        // Create reverse animation
        reverseTweenRef.current = new Konva.Tween({
          node,
          duration: config.duration,
          easing: config.easing,
          scaleX: originalProps.scaleX,
          scaleY: originalProps.scaleY,
          opacity: originalProps.opacity,
          y: originalProps.y,
          onFinish: () => {
            isRunningRef.current = false;
            if (continuous) {
              // Small delay before next cycle
              animationFrameRef.current = requestAnimationFrame(() => {
                setTimeout(() => runAnimation(), 200);
              });
            }
          },
        });
        reverseTweenRef.current.play();
      },
    });

    tweenRef.current.play();
  }, [nodeRef, animationStyle, continuous, motionScale]);

  // Handle continuous animation
  useEffect(() => {
    if (continuous) {
      runAnimation();
    }

    return cleanup;
  }, [continuous, runAnimation, cleanup]);

  // Handle triggered one-time animation
  useEffect(() => {
    if (trigger !== undefined && trigger > 0) {
      cleanup();
      runAnimation();
    }
  }, [trigger, runAnimation, cleanup]);

  return { runAnimation, cleanup };
};

export default usePinAnimation;
