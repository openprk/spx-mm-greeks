import React, { useState, useEffect } from 'react';
import Heatmap from './Heatmap';
import ConductivityCard from './ConductivityCard';
import TerrainTable from './TerrainTable';
import Legend from './Legend';
import { useApiPolling } from '../hooks/useApiPolling';
import type { ExposuresResponse } from '../types/api';

interface DTEViewProps {
  activeTab: 'structural' | '0dte';
}

const DTEView: React.FC<DTEViewProps> = ({ activeTab }) => {
  // 0DTE-specific states - always use 0DTE mode
  const [exposuresData, setExposuresData] = useState<ExposuresResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fixed settings for 0DTE view
  const mode = '0DTE';
  const metric = 'GEX'; // Focus on GEX as amplifier
  const refreshInterval = 1000; // 1 second for intraday
  const vixRegime = 'AUTO';
  const expiration = 'ALL'; // 0DTE aggregates today's data

  // Initialize polling hook with 0DTE settings
  const { startPolling, stopPolling } = useApiPolling({
    refreshInterval,
    onData: (data) => {
      setExposuresData(data.exposuresData);
      setLoading(false);
      setError(null);
    },
    onError: (err) => {
      setError(err);
      setLoading(false);
    },
  });

  // Start polling only when 0DTE tab is active
  useEffect(() => {
    if (activeTab === '0dte') {
      console.log('🚀 Starting 0DTE polling - tab is active');
      startPolling(expiration, metric, vixRegime, mode);
    } else {
      console.log('⏸️ 0DTE tab not active, stopping polling');
      stopPolling();
    }

    return () => {
      console.log('🛑 Cleaning up 0DTE polling');
      stopPolling();
    };
  }, [activeTab, startPolling, stopPolling]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          SPX 0DTE (SPXW) Intraday Analysis
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Real-time gamma exposure analysis for today's expiration only.
          Focus on GEX amplification, DEX direction, and CEX time drift in the final hours.
        </p>
      </div>

      {/* Top Row: Market Clock and Key Metrics */}
      <div className="space-y-6">
        {/* Key 0DTE Metrics */}
        <div>
          {exposuresData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* GEX - Primary Focus */}
              <div className="card">
                <div className="text-sm font-medium text-gray-500 mb-2">GEX (Gamma Amplifier)</div>
                <div className={`text-2xl font-bold ${exposuresData.aggregate.gex < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {exposuresData.aggregate.gex < 0 ? '🐂' : '🐻'} {Math.abs(exposuresData.aggregate.gex).toLocaleString()}K
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {exposuresData.aggregate.gex < 0 ? 'Bullish momentum amplifier' : 'Bearish momentum amplifier'}
                </div>
              </div>

              {/* DEX - Direction */}
              <div className="card">
                <div className="text-sm font-medium text-gray-500 mb-2">DEX (Delta Direction)</div>
                <div className={`text-2xl font-bold ${exposuresData.aggregate.dex > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {exposuresData.aggregate.dex > 0 ? '↗️' : '↘️'} {Math.abs(exposuresData.aggregate.dex).toLocaleString()}K
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Market maker positioning bias
                </div>
              </div>

              {/* CEX - Time Critical */}
              <div className="card border-2 border-orange-200 bg-orange-50">
                <div className="text-sm font-medium text-gray-700 mb-2">⚠️ CEX (Time Drift)</div>
                <div className={`text-2xl font-bold ${exposuresData.aggregate.cex > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {exposuresData.aggregate.cex > 0 ? '⏰' : '🕐'} {Math.abs(exposuresData.aggregate.cex).toLocaleString()}K
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Critical in final 2 hours - accelerates momentum
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Heatmap - GEX Focus */}
        <div className="xl:col-span-2">
          <div className="card">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">GEX Heatmap (SPXW Today Only)</h3>
              <p className="text-sm text-gray-600">
                Strike-level gamma exposure for today's expiration.
                Red = Bearish positioning, Green = Bullish positioning.
              </p>
            </div>
            <Heatmap
              matrixData={null}
              exposuresData={exposuresData}
              metric="GEX"
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
            instrument="SPX"
          />

          {/* Market Alerts - Dynamic based on regime */}
          <Legend exposuresData={exposuresData} />

          {/* 0DTE-Specific Terrain */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">0DTE Strike Terrain</h3>
            <p className="text-sm text-gray-600 mb-4">
              Key strikes within ±400 points of SPX spot. Focus on high OI strikes near ATM.
            </p>
            <TerrainTable
              exposuresData={exposuresData}
              loading={loading}
              mode="0DTE"
            />
          </div>

          {/* 0DTE Trading Notes */}
          <div className="card bg-blue-50 border-blue-200">
            <h4 className="text-md font-semibold text-blue-900 mb-2">0DTE Trading Notes</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• GEX negative = momentum amplification in either direction</li>
              <li>• CEX becomes critical in final 2 hours</li>
              <li>• High OI strikes act as magnets</li>
              <li>• SPXW moves 2-3x faster than SPX</li>
              <li>• Time decay accelerates exponentially</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card border-red-200 bg-red-50">
          <div className="text-red-800">
            <strong>0DTE Data Error:</strong> {error}
          </div>
          <div className="text-sm text-red-600 mt-2">
            Check market hours - 0DTE data only available during regular trading hours.
          </div>
        </div>
      )}
    </div>
  );
};

export default DTEView;