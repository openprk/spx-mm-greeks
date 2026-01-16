import React from 'react';
import type { ExposuresResponse } from '../types/api';

interface ConductivityCardProps {
  exposuresData: ExposuresResponse | null;
  loading: boolean;
}

const ConductivityCard: React.FC<ConductivityCardProps> = ({
  exposuresData,
  loading
}) => {

  if (loading && !exposuresData) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Conductivity</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!exposuresData) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Conductivity</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const { aggregate, spot, vix_regime_used } = exposuresData;

  const getConductivityColor = (conductivity: string) => {
    switch (conductivity.toLowerCase()) {
      case 'rally-conducive':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'sell-off-conducive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'conditional_void':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'bounce_candidate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'structural_support':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ceiling_magnet':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'acceleration_zone':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Conductivity</h3>

      {/* SPX Spot */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900">
          {spot.toFixed(2)}
        </div>
        <div className="text-sm text-gray-600">SPX Spot</div>
      </div>

      {/* Conductivity Label */}
      <div className="mb-4">
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getConductivityColor(aggregate.conductivity)}`}>
          {aggregate.conductivity}
        </div>
      </div>

      {/* Regime Code */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Regime Code</div>
        <div className="font-mono text-lg font-semibold text-gray-900">
          {aggregate.regime_code}
        </div>
      </div>

      {/* Exposure Values */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">Exposure Values</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span>GEX:</span>
            <span className={`font-semibold ${
              aggregate.regime.g === '+' ? 'text-green-600' :
              aggregate.regime.g === '-' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {aggregate.regime.g} ({(aggregate.gex / 1e12).toFixed(1)}T)
            </span>
          </div>
          <div className="flex justify-between">
            <span>DEX:</span>
            <span className={`font-semibold ${
              aggregate.regime.d === '+' ? 'text-green-600' :
              aggregate.regime.d === '-' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {aggregate.regime.d} ({(aggregate.dex / 1e9).toFixed(0)}B)
            </span>
          </div>
          <div className="flex justify-between">
            <span>VEX:</span>
            <span className={`font-semibold ${
              aggregate.regime.v === '+' ? 'text-green-600' :
              aggregate.regime.v === '-' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {aggregate.regime.v} ({(aggregate.vex / 1e9).toFixed(0)}B)
            </span>
          </div>
          <div className="flex justify-between">
            <span>CEX:</span>
            <span className={`font-semibold ${
              aggregate.regime.c === '+' ? 'text-green-600' :
              aggregate.regime.c === '-' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {aggregate.regime.c} ({(aggregate.cex / 1e9).toFixed(0)}B)
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Analysis</div>
        <p className="text-sm text-gray-800 leading-relaxed">
          {aggregate.notes}
        </p>
      </div>

      {/* VIX Regime */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          VIX Regime Used: <span className="font-medium">{vix_regime_used}</span>
        </div>
      </div>
    </div>
  );
};

export default ConductivityCard;