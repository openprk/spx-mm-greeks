import React, { useMemo } from 'react';
import type { ExposuresResponse } from '../types/api';

interface TerrainTableProps {
  exposuresData: ExposuresResponse | null;
  loading: boolean;
  mode?: '0DTE' | 'STRUCTURAL';
}

const TerrainTable: React.FC<TerrainTableProps> = ({
  exposuresData,
  loading,
  mode = 'STRUCTURAL'
}) => {
  // Calculate strike range based on mode (available in render)
  const strikeRange = mode === '0DTE' ? 400 : 200; // ±400 for 0DTE, ±200 for structural

  const terrainData = useMemo(() => {
    if (!exposuresData) return [];

    const spot = exposuresData.spot;
    const nearbyStrikes = exposuresData.strikes
      .filter(strike => Math.abs(strike.strike - spot) <= strikeRange)
      .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));

    // Also include strikes with pattern flags (even if outside range)
    const flaggedStrikes = exposuresData.strikes
      .filter(strike => strike.pattern_flags.length > 0)
      .filter(strike => !nearbyStrikes.find(s => s.strike === strike.strike));

    // Also include top absolute exposures ("walls") - strikes with highest exposure magnitudes
    const allStrikesForWalls = exposuresData.strikes.filter(strike =>
      !nearbyStrikes.find(s => s.strike === strike.strike) &&
      !flaggedStrikes.find(s => s.strike === strike.strike)
    );

    // Sort by absolute exposure magnitude and take top 10 walls
    const topWalls = allStrikesForWalls
      .map(strike => ({
        strike,
        magnitude: Math.max(
          Math.abs(strike.gex),
          Math.abs(strike.dex),
          Math.abs(strike.vex),
          Math.abs(strike.cex)
        )
      }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 10)
      .map(item => item.strike);

    // For 0DTE mode, enforce the range limit on ALL strikes (including flagged and walls)
    const allStrikesFiltered = [...nearbyStrikes, ...flaggedStrikes, ...topWalls]
      .filter(strike => mode !== '0DTE' || Math.abs(strike.strike - spot) <= strikeRange)
      .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));

    // Show all relevant strikes (no artificial limit)
    return allStrikesFiltered;
  }, [exposuresData, mode]);

  const formatExposure = (value: number) => {
    // Consistent K format: K = thousands of millions (billions)
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}K`;  // 1M becomes 1.0K (billions)
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;     // 1K becomes 1.0K (millions)
    }
    return value.toFixed(0);
  };

  const getRegimeColor = (sign: string) => {
    switch (sign) {
      case '+': return 'text-green-600 bg-green-50';
      case '-': return 'text-red-600 bg-red-50';
      case 'o': return 'text-gray-500 bg-gray-50';
      default: return 'text-gray-900 bg-white';
    }
  };

  if (loading && !exposuresData) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strike Terrain</h3>
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!exposuresData || terrainData.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strike Terrain</h3>
        <p className="text-gray-500 text-sm">No strike data available</p>
      </div>
    );
  }

  const spot = exposuresData.spot;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Strike Terrain</h3>

      <div className="text-xs text-gray-500 mb-3">
        Key strikes within ±{strikeRange}pts of SPX {spot.toFixed(0)}, plus flagged strikes and exposure walls
      </div>

      {/* Educational Context */}
      <div className="mb-4 text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
        <div className="font-medium text-blue-900 mb-2">Understanding Strike Terrain:</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>Strike:</strong> Option strike price<br/>
            <strong>Regime:</strong> G/D/V/C directional signs<br/>
            <strong>GEX/DEX:</strong> Exposure magnitudes
          </div>
          <div>
            <strong>OI:</strong> Total open interest<br/>
            <strong>Terrain:</strong> Strike classification<br/>
            <strong>Flags:</strong> Alert patterns
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-blue-300 text-blue-800">
          <strong>Key:</strong> Yellow = At SPX level, Red background = Pattern flags
        </div>
      </div>

      <div className="overflow-auto max-h-96">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2 font-medium text-gray-700 text-xs">Strike</th>
              <th className="text-center py-1 px-1 font-medium text-gray-700 text-xs">Regime</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs">GEX</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs">DEX</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs">OI</th>
              <th className="text-left py-1 px-2 font-medium text-gray-700 text-xs">Terrain</th>
            </tr>
          </thead>
          <tbody>
            {terrainData.map((strike) => {
              const isAtSpot = Math.abs(strike.strike - spot) < 5;
              const hasFlags = strike.pattern_flags.length > 0;

              return (
                <tr
                  key={strike.strike}
                  className={`border-b border-gray-100 ${
                    isAtSpot ? 'bg-yellow-50' :
                    hasFlags ? 'bg-red-50' : ''
                  }`}
                >
                  {/* Strike */}
                  <td className="py-1 px-2 font-medium text-sm">
                    {strike.strike}
                    {isAtSpot && (
                      <span className="ml-1 text-xs text-yellow-600">← SPX</span>
                    )}
                  </td>

                  {/* Regime Code */}
                  <td className="py-1 px-1 text-center font-mono">
                    <div className="flex gap-0.5 justify-center">
                      <span className={`px-1 rounded text-xs ${getRegimeColor(strike.regime.g)}`}>
                        {strike.regime.g}
                      </span>
                      <span className={`px-1 rounded text-xs ${getRegimeColor(strike.regime.d)}`}>
                        {strike.regime.d}
                      </span>
                      <span className={`px-1 rounded text-xs ${getRegimeColor(strike.regime.v)}`}>
                        {strike.regime.v}
                      </span>
                      <span className={`px-1 rounded text-xs ${getRegimeColor(strike.regime.c)}`}>
                        {strike.regime.c}
                      </span>
                    </div>
                  </td>

                  {/* GEX */}
                  <td className={`py-1 px-2 text-right text-sm ${
                    strike.gex > 0 ? 'text-green-600' :
                    strike.gex < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatExposure(strike.gex)}
                  </td>

                  {/* DEX */}
                  <td className={`py-1 px-2 text-right text-sm ${
                    strike.dex > 0 ? 'text-green-600' :
                    strike.dex < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatExposure(strike.dex)}
                  </td>

                  {/* Open Interest */}
                  <td className="py-1 px-2 text-right text-gray-600 text-sm">
                    {formatExposure(strike.call_oi + strike.put_oi)}
                  </td>

                  {/* Terrain & Flags */}
                  <td className="py-1 px-2">
                    <div className="max-w-24">
                      <div className="text-xs truncate" title={strike.classification}>
                        {strike.classification.split(' — ')[0]}
                      </div>
                      {strike.pattern_flags.length > 0 && (
                        <div className="mt-1 space-x-1">
                          {strike.pattern_flags.map(flag => (
                            <span
                              key={flag}
                              className="inline-block px-1 py-0.5 text-xs bg-red-100 text-red-800 rounded"
                            >
                              {flag.replace('MAX_DOWNSIDE_', 'MAX ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="flex items-center">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded mr-1"></div>
            At SPX
          </span>
          <span className="flex items-center">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded mr-1"></div>
            Pattern Flag
          </span>
        </div>
      </div>
    </div>
  );
};

export default TerrainTable;