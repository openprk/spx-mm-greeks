// Type declarations for react-plotly.js
declare module 'react-plotly.js' {
  import React from 'react';

  export interface PlotParams {
    data: any[];
    layout?: any;
    frames?: any[];
    config?: any;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure?: any, graphDiv?: any) => void;
    onError?: (error?: any) => void;
    transition?: any;
  }

  export default class Plot extends React.Component<PlotParams> {}
}