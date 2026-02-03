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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          SPX Structural Analysis (All Expirations)
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
        <div className="space-y-6">
          {/* Conductivity Analysis */}
          <ConductivityCard
            exposuresData={exposuresData}
            loading={loading}
          />

          {/* Legend */}
          <Legend exposuresData={exposuresData} />

          {/* Terrain Analysis */}
          <TerrainTable
            exposuresData={exposuresData}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default StructuralView;