declare module 'react-katex' {
  import { ComponentType, CSSProperties } from 'react';

  export interface InlineMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
    settings?: any;
  }

  export interface BlockMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
    settings?: any;
  }

  export const InlineMath: ComponentType<InlineMathProps>;
  export const BlockMath: ComponentType<BlockMathProps>;
}

