import type { ComponentType, CSSProperties } from 'react';
export interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  highlightClass?: string;
  trigger?: 'auto' | 'click' | 'hover' | 'scroll';
  variant?: 'text' | 'tiles';
  split?: 'words' | 'letters';
  gravity?: number;
  bounciness?: number;
  scatter?: number;
  stagger?: number;
  order?: 'random' | 'center' | 'together' | 'sequential';
  draggable?: boolean;
  mouseConstraintStiffness?: number;
  cursorPush?: number;
  restoreDelay?: number;
  fontSize?: string;
  accentColor?: string;
  theme?: 'light' | 'dark';
  backgroundColor?: string;
  wireframes?: boolean;
  className?: string;
  style?: CSSProperties;
}
declare const FallingText: ComponentType<FallingTextProps>;
export default FallingText;
