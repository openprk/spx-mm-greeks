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
      // Aggregate exposure by strike across all expirations for UW-style chart
      const strikeExposureMap = new Map<number, {
        exposure: number;
        regime: string;
        gex: number;
        dex: number;
        vex: number;
        cex: number;
        call_oi: number;
        put_oi: number;
        patterns: string[];
      }>();

      // Aggregate data across all expirations for each strike
      matrixData.y_strikes.forEach((strike, strikeIndex) => {
        let totalExposure = 0;
        let totalGex = 0;
        let totalDex = 0;
        let totalVex = 0;
        let totalCex = 0;
        let totalCallOi = 0;
        let totalPutOi = 0;
        let patterns: string[] = [];
        let regime = '';

        matrixData.x_expirations.forEach((expiration, expIndex) => {
          const exposure = matrixData.z[strikeIndex]?.[expIndex] || 0;
          if (exposure !== 0) {
            totalExposure += exposure;
          }
        });

        // Get strike details for hover info
        const strikeKey = strike.toString();
        const details = matrixData.strike_details?.[strikeKey];
        if (details) {
          totalGex = details.gex;
          totalDex = details.dex;
          totalVex = details.vex;
          totalCex = details.cex;
          totalCallOi = details.call_oi;
          totalPutOi = details.put_oi;
          regime = details.regime_code;
          patterns = details.pattern_flags;
        }

        strikeExposureMap.set(strike, {
          exposure: totalExposure,
          regime,
          gex: totalGex,
          dex: totalDex,
          vex: totalVex,
          cex: totalCex,
          call_oi: totalCallOi,
          put_oi: totalPutOi,
          patterns
        });
      });

      // Create horizontal bar chart data (strikes vertical on Y, exposure horizontal on X)
      // Display values in millions (÷1e6) with K = thousands of millions = billions
      const barData = Array.from(strikeExposureMap.entries())
        .filter(([_, data]) => Math.abs(data.exposure) > 0.01) // Filter out near-zero exposures
        .sort((a, b) => a[0] - b[0]) // Sort by strike price
        .map(([strike, data]) => ({
          x: [data.exposure / 1e6], // Divide by 1e6 to show in millions (UW standard)
          y: [strike],        // Strike price on Y-axis (vertical)
          type: 'bar' as const,
          orientation: 'h' as const, // Horizontal bars
          name: `Strike ${strike}`,
          marker: {
            color: data.exposure >= 0 ? '#dc2626' : '#2563eb', // Red for positive, blue for negative
            line: {
              width: 0
            }
          },
          customdata: [[
            data.regime,
            data.gex / 1e6,  // Display individual Greeks in millions (UW standard)
            data.dex / 1e6,
            data.vex / 1e6,
            data.cex / 1e6,
            data.call_oi,
            data.put_oi,
            data.patterns.length > 0 ? data.patterns.join(', ') : ''
          ]],
          hovertemplate:
            `<b>Strike %{y:,.0f}</b><br>` +
            `<b>${metric}:</b> %{x:.1f}K<br>` +
            `<b>Regime:</b> %{customdata[0]}<br>` +
            `<b>GEX:</b> %{customdata[1]:.1f}K | <b>DEX:</b> %{customdata[2]:.1f}K<br>` +
            `<b>VEX:</b> %{customdata[3]:.1f}K | <b>CEX:</b> %{customdata[4]:.1f}K<br>` +
            `<b>OI:</b> %{customdata[5]}/%{customdata[6]}` +
            `%{customdata[7]:+%<br><b>⚠️ %{customdata[7]}</b>%}` +
            `<extra></extra>`
        }));

      // Add vertical line at zero exposure (center line for horizontal bars)
      const zeroLine = {
        x: [0, 0],
        y: [Math.min(...Array.from(strikeExposureMap.keys())), Math.max(...Array.from(strikeExposureMap.keys()))],
        mode: 'lines' as const,
        line: {
          color: '#6b7280',
          width: 2,
          dash: 'solid'
        },
        showlegend: false,
        hovertemplate: 'Zero Exposure<extra></extra>'
      };

      // Add SPX spot horizontal reference line (prominent middle line)
      const allExposures = Array.from(strikeExposureMap.values()).map(d => d.exposure);
      const minExposure = Math.min(...allExposures);
      const maxExposure = Math.max(...allExposures);
      const exposureRange = maxExposure - minExposure;

      const spotLine = {
        x: [minExposure - exposureRange * 0.2, maxExposure + exposureRange * 0.2],
        y: [spot, spot],
        mode: 'lines' as const,
        line: {
          color: '#f59e0b',
          width: 3,
          dash: 'solid'
        },
        name: `SPX Spot: ${spot.toFixed(0)}`,
        hovertemplate: `SPX Spot: ${spot.toFixed(2)}<extra></extra>`,
        showlegend: true
      };

      traces.push(...barData, zeroLine, spotLine);

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
            strikeData.gex / 1e6,  // Display in millions (UW standard)
            strikeData.dex / 1e6,
            strikeData.vex / 1e6,
            strikeData.cex / 1e6,
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
            `<b>${greek}:</b> %{y:.1f}K<br>` +
            `<b>Regime:</b> %{customdata[0]}<br>` +
            `<b>GEX:</b> %{customdata[2]:.1f}K | <b>DEX:</b> %{customdata[3]:.1f}K<br>` +
            `<b>VEX:</b> %{customdata[4]:.1f}K | <b>CEX:</b> %{customdata[5]:.1f}K<br>` +
            `<b>OI:</b> %{customdata[6]}/%{customdata[7]}` +
            `%{customdata[8]:+%<br><b>⚠️ %{customdata[8]}</b>%}` +
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
          text: `SPX Market Maker ${metric} Exposure`,
          font: { size: 18, color: '#1f2937', weight: 'bold' },
          x: 0.5,
          y: 0.95,
          xanchor: 'center' as const,
          yanchor: 'top' as const
        },
        annotations: [{
          text: `Per 1% move • Aggregated across all expirations`,
          showarrow: false,
          x: 0.5,
          y: 0.89,
          xref: 'paper',
          yref: 'paper',
          xanchor: 'center',
          yanchor: 'top',
          font: { size: 12, color: '#6b7280' }
        }],
        margin: { t: 100, r: 80, b: 60, l: 100 },
        bargap: 0.1, // Gap between bars
        xaxis: {
          title: {
            text: `${metric} (K)`,
            font: { size: 13, color: '#6b7280' }
          },
          type: 'linear' as const,
          showgrid: true,
          gridcolor: '#f3f4f6',
          showline: true,
          linecolor: '#d1d5db',
          linewidth: 1,
          tickfont: { size: 10 },
          tickformat: ',.0f',
          mirror: false,
          zeroline: false
        },
        yaxis: {
          title: {
            text: 'Strike',
            font: { size: 13, color: '#6b7280' }
          },
          type: 'linear' as const,
          showgrid: false,
          showline: true,
          linecolor: '#d1d5db',
          linewidth: 1,
          tickfont: { size: 10 },
          tickformat: ',.0f',
          mirror: false,
          autorange: 'reversed' // Higher strikes at top, lower at bottom
        }
      };
    } else {
      return {
        ...baseLayout,
        title: {
          text: `SPX Market Maker Greek Exposures - ${expiration}`,
          font: { size: 16, color: '#1f2937', weight: 'bold' },
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
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],  // Keep pan2d for drag functionality
              modeBarButtonsToAdd: ['drawline', 'drawopenpath', 'pan2d'],  // Add drag-to-pan
              responsive: true,             // Enable responsive behavior
              doubleClick: 'reset' as const,
              scrollZoom: true,             // Enable scroll to zoom
              dragmode: 'pan'              // Enable drag-to-pan by default
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