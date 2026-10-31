import type { ComponentType } from 'react';
export interface BlurTextProps {
  as?: 'p' | 'span' | 'div';
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  threshold?: number;
  rootMargin?: string;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  blur?: number;
  distance?: number;
  effect?: 'blur' | 'zoom' | 'tilt' | 'focus' | 'drift';
  staggerFrom?: 'start' | 'end' | 'center' | 'random';
  trigger?: 'view' | 'load' | 'hover' | 'click';
  loop?: boolean;
  loopDelay?: number;
  color?: string;
  fromColor?: string;
  focusOnHover?: boolean;
}
declare const BlurText: ComponentType<BlurTextProps>;
export default BlurText;
