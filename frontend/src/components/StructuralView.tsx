import React from 'react';
import Heatmap from './Heatmap';
import Controls from './Controls';
import Legend from './Legend';
import ConductivityCard from './ConductivityCard';
import TerrainTable from './TerrainTable';
import type { ExposuresResponse, ExposuresMatrixResponse } from '../types/api';

interface StructuralViewProps {
  // Control states
  expiration: string;
  metric: 'GEX' | 'DEX' | 'VEX' | 'CEX';
  refreshInterval: number;
  vixRegime: 'RISING' | 'FALLING' | 'AUTO';
  expirations: string[];
  loading: boolean;

  // Data states
  exposuresData: ExposuresResponse | null;
  matrixData: ExposuresMatrixResponse | null;

  // Handlers
  onControlsChange: (
    expiration: string,
    metric: 'GEX' | 'DEX' | 'VEX' | 'CEX',
    refreshInterval: number,
    vixRegime: 'RISING' | 'FALLING' | 'AUTO'
  ) => void;
}

const StructuralView: React.FC<StructuralViewProps> = ({
  expiration,
  metric,
  refreshInterval,
  vixRegime,
  expirations,
  loading,
  exposuresData,
  matrixData,
  onControlsChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl xl:text-3xl 2xl:text-4xl font-bold text-gray-900 mb-2">
          SPX Structural Analysis (All Expirations)
        </h1>
        <p className="text-sm xl:text-base text-gray-600 max-w-2xl mx-auto">
          Multi-expiration gamma exposure analysis. Use for longer-term positioning,
          structural support/resistance, and regime identification.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <Controls
          expiration={expiration}
          metric={metric}
          refreshInterval={refreshInterval}
          vixRegime={vixRegime}
          expirations={expirations}
          onChange={onControlsChange}
          loading={loading}
        />
      </div>

      {/* Main Analysis Grid */}
      <div className="xl:space-y-6">
        {/* Main Grid for Chart and Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8 xl:h-[calc(100vh-200px)]">
          {/* Heatmap */}
          <div className="xl:col-span-2">
            <div className="card">
              <Heatmap
                matrixData={expiration === 'ALL' ? matrixData : null}
                exposuresData={expiration === 'ALL' ? null : exposuresData}
                metric={metric}
                expiration={expiration}
                loading={loading}
              />
            </div>
          </div>

          {/* Side Panel */}
          <div className="xl:col-span-1">
            {/* For smaller screens: No scrolling, include terrain table */}
            <div className="xl:hidden space-y-4">
              {/* Conductivity Analysis */}
              <ConductivityCard
                exposuresData={exposuresData}
                loading={loading}
              />

              {/* Legend */}
              <Legend exposuresData={exposuresData} />

              {/* Terrain Table for smaller screens */}
              <TerrainTable
                exposuresData={exposuresData}
                loading={loading}
              />
            </div>

            {/* For XL screens: Scrollable, no terrain table in sidebar */}
            <div className="hidden xl:block h-full">
              <div className="overflow-y-auto h-full space-y-6 max-h-[calc(100vh-160px)]">
                {/* Conductivity Analysis */}
                <ConductivityCard
                  exposuresData={exposuresData}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Spacing for XL screens */}
        <div className="hidden xl:block xl:h-8 2xl:h-12"></div>

        {/* Market Alerts - Below main grid, above terrain table (XL only) */}
        <div className="hidden xl:block">
          <div className="xl:mt-8 2xl:mt-10">
            <Legend exposuresData={exposuresData} />
          </div>
        </div>

        {/* Full-width Terrain Table (XL and above) */}
        <div className="hidden xl:block">
          <div className="card">
            <h3 className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 mb-4">Strike Terrain</h3>
            <p className="text-sm xl:text-base text-gray-600 mb-4">
              Key strikes within ±200 points of SPX spot, plus flagged strikes and exposure walls
            </p>
            <TerrainTable
              exposuresData={exposuresData}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructuralView;