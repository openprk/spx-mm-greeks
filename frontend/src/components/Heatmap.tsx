import React, { useMemo, useEffect } from 'react';
import Plot from 'react-plotly.js';
import * as Plotly from 'plotly.js';
import type { ExposuresResponse, ExposuresMatrixResponse, MetricType } from '../types/api';

interface HeatmapProps {
  matrixData: ExposuresMatrixResponse | null;
  exposuresData: ExposuresResponse | null;
  metric: MetricType;
  expiration: string;
  loading: boolean;
}

const Heatmap: React.FC<HeatmapProps> = ({
  matrixData,
  exposuresData,
  metric,
  expiration,
  loading
}) => {
  console.log('🔥 Heatmap render:', {
    hasExposuresData: !!exposuresData,
    hasMatrixData: !!matrixData,
    loading,
    expiration,
    metric,
    exposuresDataExpiration: exposuresData?.expiration,
    matrixDataMetric: matrixData?.metric,
    timestamp: new Date().toISOString()
  });

  // Browser compatibility and Plotly availability check
  useEffect(() => {
    console.log('🔍 Plotly environment check:', {
      Plotly: typeof window.Plotly,
      SVG: !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
      userAgent: navigator.userAgent,
      plotlyVersion: (Plotly as any)?.version
    });

    // Ensure Plotly is available globally
    if (typeof window !== 'undefined' && !window.Plotly && Plotly) {
      window.Plotly = Plotly;
      console.log('✅ Plotly attached to window');
    }
  }, []);

  const plotData = useMemo(() => {
    if (!exposuresData && !matrixData) {
      console.log('❌ No data available');
      return [];
    }

    const spot = exposuresData?.spot || matrixData?.spot || 0;
    const traces: any[] = [];

    // Validate data before creating traces
    if (expiration === 'ALL' && matrixData) {
      if (!matrixData.z || matrixData.z.length === 0) {
        console.error('❌ Invalid heatmap data: z array is empty');
        return [];
      }
      if (!matrixData.x_expirations || matrixData.x_expirations.length === 0) {
        console.error('❌ Invalid heatmap data: x_expirations is empty');
        return [];
      }
      if (!matrixData.y_strikes || matrixData.y_strikes.length === 0) {
        console.error('❌ Invalid heatmap data: y_strikes is empty');
        return [];
      }
      // Check if z data contains actual values (not just zeros)
      const hasValidData = matrixData.z.some(row => row.some(val => val !== 0 && !isNaN(val)));
      if (!hasValidData) {
        console.warn('⚠️ Heatmap data contains only zeros or invalid values');
      }
    } else if (exposuresData) {
      if (!exposuresData.strikes || exposuresData.strikes.length === 0) {
        console.error('❌ Invalid line chart data: strikes array is empty');
        return [];
      }
    }

    if (expiration === 'ALL' && matrixData) {
      // Simplified customdata for rich hover information
      const customdata = matrixData.y_strikes.map(strike => {
        const strikeKey = strike.toString();
        const details = matrixData.strike_details?.[strikeKey];

        return details ? [
          details.regime_code,
          details.classification,
          details.gex,
          details.dex,
          details.vex,
          details.cex,
          details.call_oi,
          details.put_oi,
          details.pattern_flags.length > 0 ? details.pattern_flags.join(', ') : ''
        ] : ['', '', 0, 0, 0, 0, 0, 0, ''];
      });

      // Enhanced heatmap for ALL expirations with rich tooltips
      const heatmapTrace = {
        z: matrixData.z,
        x: matrixData.x_expirations,
        y: matrixData.y_strikes,
        type: 'heatmap' as const,
        colorscale: [
          [0, '#1e3a8a'],    // Deep blue for very negative
          [0.2, '#3b82f6'],  // Blue for negative
          [0.4, '#93c5fd'],  // Light blue for low negative
          [0.5, '#f3f4f6'],  // Gray for neutral
          [0.6, '#fed7aa'],  // Light orange for low positive
          [0.8, '#f59e0b'],  // Orange for positive
          [1, '#dc2626']     // Red for very positive
        ] as [number, string][],
        zmid: 0,
        hoverongaps: false,
        customdata: customdata,
        xgap: 1,
        ygap: 1,
        hovertemplate:
          `<b>%{x} | Strike %{y}</b><br>` +
          `<b>${metric}:</b> %{z:.2s}<br>` +
          `<b>Regime:</b> %{customdata[0]}<br>` +
          `<b>Classification:</b> %{customdata[1]}<br>` +
          `<b>GEX:</b> %{customdata[2]:.2s} | <b>DEX:</b> %{customdata[3]:.2s}<br>` +
          `<b>VEX:</b> %{customdata[4]:.2s} | <b>CEX:</b> %{customdata[5]:.2s}<br>` +
          `<b>OI:</b> %{customdata[6]} Calls | %{customdata[7]} Puts` +
          `%{customdata[8]:+%<br><b>⚠️ Patterns:</b> %{customdata[8]}%}` +
          `<extra></extra>`,
        showscale: true,
        colorbar: {
          title: {
            text: metric,
            side: 'right'
          },
          titleside: 'right',
          thickness: 20,
          len: 0.8
        }
      };

      // SPX spot reference line
      const spotLineTrace = {
        x: matrixData.x_expirations,
        y: new Array(matrixData.x_expirations.length).fill(spot),
        mode: 'lines' as const,
        line: {
          color: '#fbbf24',
          width: 3,
          dash: 'dash'
        },
        name: `SPX Spot: ${spot.toFixed(2)}`,
        hovertemplate: `SPX Spot: ${spot.toFixed(2)}<extra></extra>`,
        showlegend: true
      };

      traces.push(heatmapTrace, spotLineTrace);

    } else if (exposuresData) {
      // Multi-line chart for single expiration showing all Greeks
      const strikes = exposuresData.strikes.map(s => s.strike).sort((a, b) => a - b);

      // Color scheme for different Greeks
      const greekColors = {
        GEX: '#3b82f6',  // Blue
        DEX: '#10b981',  // Green
        VEX: '#f59e0b',  // Orange
        CEX: '#ef4444'   // Red
      };

      const greekNames = {
        GEX: 'Gamma Exposure (GEX)',
        DEX: 'Delta Exposure (DEX)',
        VEX: 'Vanna Exposure (VEX)',
        CEX: 'Charm Exposure (CEX)'
      };

      ['GEX', 'DEX', 'VEX', 'CEX'].forEach(greek => {
        const values = exposuresData.strikes.map(s => {
          switch (greek) {
            case 'GEX': return s.gex;
            case 'DEX': return s.dex;
            case 'VEX': return s.vex;
            case 'CEX': return s.cex;
            default: return 0;
          }
        });

        // Simplified customdata for rich hover information
        const customdata = strikes.map(strike => {
          const strikeData = exposuresData.strikes.find(s => s.strike === strike);
          return strikeData ? [
            strikeData.regime_code,
            strikeData.classification,
            strikeData.gex,
            strikeData.dex,
            strikeData.vex,
            strikeData.cex,
            strikeData.call_oi,
            strikeData.put_oi,
            strikeData.pattern_flags.length > 0 ? strikeData.pattern_flags.join(', ') : ''
          ] : ['', '', 0, 0, 0, 0, 0, 0, ''];
        });

        const lineTrace = {
          x: strikes,
          y: values,
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          name: greek,
          customdata: customdata,
          hovertemplate:
            `<b>Strike %{x}</b><br>` +
            `<b>${greekNames[greek as keyof typeof greekNames]}:</b> %{y:.2s}<br>` +
            `<b>Regime:</b> %{customdata[0]}<br>` +
            `<b>Classification:</b> %{customdata[1]}<br>` +
            `<b>GEX:</b> %{customdata[2]:.2s} | <b>DEX:</b> %{customdata[3]:.2s}<br>` +
            `<b>VEX:</b> %{customdata[4]:.2s} | <b>CEX:</b> %{customdata[5]:.2s}<br>` +
            `<b>OI:</b> %{customdata[6]} Calls | %{customdata[7]} Puts` +
            `%{customdata[8]:+%<br><b>⚠️ Patterns:</b> %{customdata[8]}%}` +
            `<extra></extra>`,
          line: {
            color: greekColors[greek as keyof typeof greekColors],
            width: 3,
            shape: 'spline' as const
          },
          marker: {
            size: 4,
            color: greekColors[greek as keyof typeof greekColors]
          }
        };

        traces.push(lineTrace);
      });

      // Add SPX spot reference line
      const allValues = exposuresData.strikes.flatMap(s => [s.gex, s.dex, s.vex, s.cex]);
      const yMin = Math.min(...allValues);
      const yMax = Math.max(...allValues);

      const spotLineTrace = {
        x: [spot, spot],
        y: [yMin * 1.1, yMax * 1.1], // Extend slightly beyond data range
        mode: 'lines' as const,
        line: {
          color: '#fbbf24',
          width: 2,
          dash: 'dash'
        },
        name: `SPX Spot: ${spot.toFixed(2)}`,
        hovertemplate: `SPX Spot: ${spot.toFixed(2)}<extra></extra>`,
        showlegend: true
      };

      traces.push(spotLineTrace);
    }

    console.log('✅ Final plotData:', traces.length, 'traces');
    return traces;
  }, [exposuresData, matrixData, metric, expiration]);

  const layout = useMemo(() => {
    const baseLayout = {
      margin: { t: 80, r: 120, b: 80, l: 80 },
      height: 500,
      width: undefined,
      autosize: true,
      showlegend: true,
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      font: {
        family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        size: 12
      }
    };

    if (expiration === 'ALL') {
      return {
        ...baseLayout,
        title: {
          text: `SPX ${metric} Exposures - All Expirations`,
          font: { size: 18, color: '#1f2937' },
          x: 0.5,
          y: 0.95,
          xanchor: 'center' as const,
          yanchor: 'top' as const
        },
        xaxis: {
          title: {
            text: 'Expiration Date',
            font: { size: 14, color: '#6b7280' }
          },
          type: 'category' as const,
          showgrid: true,
          gridcolor: '#f3f4f6',
          linecolor: '#e5e7eb',
          tickfont: { size: 11 }
        },
        yaxis: {
          title: {
            text: 'Strike Price',
            font: { size: 14, color: '#6b7280' }
          },
          type: 'linear' as const,
          showgrid: true,
          gridcolor: '#f3f4f6',
          linecolor: '#e5e7eb',
          tickfont: { size: 11 }
        }
      };
    } else {
      return {
        ...baseLayout,
        title: {
          text: `SPX Greek Exposures - ${expiration}`,
          font: { size: 18, color: '#1f2937' },
          x: 0.5,
          y: 0.95,
          xanchor: 'center' as const,
          yanchor: 'top' as const
        },
        xaxis: {
          title: {
            text: 'Strike Price',
            font: { size: 14, color: '#6b7280' }
          },
          type: 'linear' as const,
          showgrid: true,
          gridcolor: '#f3f4f6',
          linecolor: '#e5e7eb',
          tickfont: { size: 11 }
        },
        yaxis: {
          title: {
            text: 'Exposure Value',
            font: { size: 14, color: '#6b7280' }
          },
          type: 'linear' as const,
          showgrid: true,
          gridcolor: '#f3f4f6',
          linecolor: '#e5e7eb',
          tickfont: { size: 11 },
          tickformat: '.2s'
        },
        legend: {
          orientation: 'h' as const,
          y: -0.2,
          x: 0.5,
          xanchor: 'center' as const,
          font: { size: 12 }
        }
      };
    }
  }, [metric, expiration]);

  // Force Plotly update when data changes
  useEffect(() => {
    if (plotData.length > 0 && (exposuresData || matrixData)) {
      console.log('🔄 Updating Plotly chart with new data');

      // Use timeout to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        const plotElement = document.querySelector('.js-plotly-plot') as HTMLElement;
        if (plotElement && window.Plotly) {
          try {
            // Try react first, fallback to newPlot
            if ((plotElement as any)._fullData) {
              window.Plotly.react(plotElement, plotData, layout);
            } else {
              window.Plotly.newPlot(plotElement, plotData, layout);
            }
            console.log('✅ Plotly chart updated successfully');
          } catch (error) {
            console.error('❌ Plotly update failed:', error);
          }
        } else {
          console.warn('⚠️ Plotly element or Plotly not ready');
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [plotData, layout, exposuresData, matrixData]);


  if (loading && !exposuresData && !matrixData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2 w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Show loading state if we have no data but expect it soon
  if (!exposuresData && !matrixData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-gray-500 text-sm">Loading chart data...</div>
        </div>
      </div>
    );
  }

  // Error boundary for chart rendering
  const renderChart = () => {
    try {
      if (plotData.length === 0) {
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-gray-500 text-sm">No chart data available</div>
            </div>
          </div>
        );
      }

      return (
        <div style={{ width: '100%', height: '500px' }}>
          <Plot
            data={plotData}
            layout={layout}
            style={{
              width: '100%',
              height: '100%'
            }}
            useResizeHandler={true}
            config={{
              displayModeBar: true,
              displaylogo: false,
              editable: false,
              modeBarButtonsToRemove: [],  // ENABLE all zoom/pan buttons
              responsive: true,             // Enable responsive behavior
              doubleClick: 'reset' as const
            }}
            transition={{
              duration: 500,
              easing: 'cubic-in-out'
            }}
            onInitialized={() => {
              console.log('✅ Plotly chart initialized successfully');
            }}
            onError={(error: any) => {
              console.error('❌ Plotly render error:', error);
            }}
          />
        </div>
      );
    } catch (error) {
      console.error('❌ Chart render error:', error);
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-red-500">
            <div className="text-lg font-semibold mb-2">Chart Error</div>
            <div className="text-sm">Failed to render chart: {error instanceof Error ? error.message : 'Unknown error'}</div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="relative">
      {renderChart()}
      {loading && (
        <div className="absolute top-4 right-4">
          <div className="bg-blue-100 border border-blue-300 rounded px-3 py-1 text-sm text-blue-800 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800 mr-2"></div>
            Updating...
          </div>
        </div>
      )}
    </div>
  );
};

export default Heatmap;