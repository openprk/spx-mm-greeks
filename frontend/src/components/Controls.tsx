import React from 'react';
import type { MetricType, VixRegimeType } from '../types/api';

interface ControlsProps {
  expiration: string;
  metric: MetricType;
  refreshInterval: number;
  vixRegime: VixRegimeType;
  expirations: string[];
  onChange: (
    expiration: string,
    metric: MetricType,
    refreshInterval: number,
    vixRegime: VixRegimeType
  ) => void;
  loading: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  expiration,
  metric,
  refreshInterval,
  vixRegime,
  expirations,
  onChange,
  loading
}) => {
  const handleExpirationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value, metric, refreshInterval, vixRegime);
  };

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(expiration, e.target.value as MetricType, refreshInterval, vixRegime);
  };

  const handleRefreshChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(expiration, metric, parseInt(e.target.value), vixRegime);
  };

  const handleVixRegimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(expiration, metric, refreshInterval, e.target.value as VixRegimeType);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Expiration Selector */}
      <div className="flex flex-col">
        <label htmlFor="expiration" className="text-sm font-medium text-gray-700 mb-1">
          Expiration
        </label>
        <select
          id="expiration"
          value={expiration}
          onChange={handleExpirationChange}
          className="select w-32"
          disabled={loading}
        >
          <option value="ALL">ALL</option>
          {expirations.map(exp => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>
      </div>

      {/* Metric Selector */}
      <div className="flex flex-col">
        <label htmlFor="metric" className="text-sm font-medium text-gray-700 mb-1">
          Metric {expiration !== 'ALL' && <span className="text-xs text-gray-500">(All shown)</span>}
        </label>
        <select
          id="metric"
          value={metric}
          onChange={handleMetricChange}
          className={`select w-24 ${expiration !== 'ALL' ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={loading || expiration !== 'ALL'}
          title={expiration !== 'ALL' ? 'All Greeks shown for single expiration' : 'Select metric for heatmap'}
        >
          <option value="GEX">GEX</option>
          <option value="DEX">DEX</option>
          <option value="VEX">VEX</option>
          <option value="CEX">CEX</option>
        </select>
      </div>

      {/* Refresh Interval */}
      <div className="flex flex-col">
        <label htmlFor="refresh" className="text-sm font-medium text-gray-700 mb-1">
          Refresh
        </label>
        <select
          id="refresh"
          value={refreshInterval}
          onChange={handleRefreshChange}
          className="select w-20"
          disabled={loading}
        >
          <option value="500">0.5s</option>
          <option value="1000">1s</option>
          <option value="2000">2s</option>
          <option value="5000">5s</option>
          <option value="10000">10s</option>
          <option value="30000">30s</option>
        </select>
      </div>

      {/* VIX Regime */}
      <div className="flex flex-col">
        <label htmlFor="vixRegime" className="text-sm font-medium text-gray-700 mb-1">
          VIX Regime
        </label>
        <select
          id="vixRegime"
          value={vixRegime}
          onChange={handleVixRegimeChange}
          className="select w-24"
          disabled={loading}
        >
          <option value="AUTO">AUTO</option>
          <option value="RISING">RISING</option>
          <option value="FALLING">FALLING</option>
        </select>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center ml-4">
        <div className={`w-3 h-3 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
        <span className="ml-2 text-sm text-gray-600">
          {loading ? 'Loading...' : 'Live'}
        </span>
      </div>
    </div>
  );
};

export default Controls;