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

    // Get all strikes within range
    const nearbyStrikes = exposuresData.strikes
      .filter(strike => Math.abs(strike.strike - spot) <= strikeRange);

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

    // Build final terrain: all nearby strikes + additional strikes, sorted by strike descending
    const allStrikes = [...nearbyStrikes, ...flaggedStrikes, ...topWalls]
      .filter(strike => mode !== '0DTE' || Math.abs(strike.strike - spot) <= strikeRange);

    // Sort by strike price descending (highest to lowest) - spot will be in the middle
    const sortedStrikes = allStrikes.sort((a, b) => b.strike - a.strike);

    // Deduplicate by strike price to avoid React key conflicts
    const seen = new Set();
    return sortedStrikes.filter(strike => {
      if (seen.has(strike.strike)) return false;
      seen.add(strike.strike);
      return true;
    });
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
    <div className="card h-full flex flex-col">
      <h3 className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 mb-4">Strike Terrain</h3>

      <div className="text-xs xl:text-sm text-gray-500 mb-3">
        Key strikes within ±{strikeRange}pts of SPX {spot.toFixed(0)}, plus flagged strikes and exposure walls
      </div>

      {/* Educational Context */}
      <div className="mb-4 text-xs xl:text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
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

      <div className="flex-1 overflow-auto min-h-0">
        <table className="min-w-full text-xs xl:text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2 font-medium text-gray-700 text-xs xl:text-sm">Strike</th>
              <th className="text-center py-1 px-1 font-medium text-gray-700 text-xs xl:text-sm">Regime</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs xl:text-sm">GEX</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs xl:text-sm">DEX</th>
              <th className="text-right py-1 px-2 font-medium text-gray-700 text-xs xl:text-sm">OI</th>
              <th className="text-left py-1 px-2 font-medium text-gray-700 text-xs xl:text-sm">Terrain</th>
            </tr>
          </thead>
          <tbody>
            {terrainData.map((strike) => {
              // Calculate exact spot strikes using floor/ceil by increment (like backend)
              const strikeIncrement = 5; // SPX strike increment
              const lowerSpotStrike = Math.floor(spot / strikeIncrement) * strikeIncrement;
              const upperSpotStrike = lowerSpotStrike + strikeIncrement;
              const isSpotStrike = strike.strike === lowerSpotStrike || strike.strike === upperSpotStrike;
              const isAtSpot = Math.abs(strike.strike - spot) < 5;
              const hasFlags = strike.pattern_flags.length > 0;

              return (
                <tr
                  key={strike.strike}
                  className={`border-b border-gray-100 ${
                    isAtSpot ? 'bg-yellow-50' :
                    (hasFlags && isSpotStrike) ? 'bg-red-50' : ''  // ALERT banner only for spot strikes
                  }`}
                >
                  {/* Strike */}
                  <td className="py-1 px-2 font-medium text-sm xl:text-base">
                    {strike.strike}
                    {isAtSpot && (
                      <span className="ml-1 text-xs xl:text-sm text-yellow-600">← SPX</span>
                    )}
                  </td>

                  {/* Regime Code */}
                  <td className="py-1 px-1 text-center font-mono">
                    <div className="flex gap-0.5 justify-center">
                      <span className={`px-1 rounded text-xs xl:text-sm ${getRegimeColor(strike.regime.g)}`}>
                        {strike.regime.g}
                      </span>
                      <span className={`px-1 rounded text-xs xl:text-sm ${getRegimeColor(strike.regime.d)}`}>
                        {strike.regime.d}
                      </span>
                      <span className={`px-1 rounded text-xs xl:text-sm ${getRegimeColor(strike.regime.v)}`}>
                        {strike.regime.v}
                      </span>
                      <span className={`px-1 rounded text-xs xl:text-sm ${getRegimeColor(strike.regime.c)}`}>
                        {strike.regime.c}
                      </span>
                    </div>
                  </td>

                  {/* GEX */}
                  <td className={`py-1 px-2 text-right text-sm xl:text-base ${
                    strike.gex > 0 ? 'text-green-600' :
                    strike.gex < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatExposure(strike.gex)}
                  </td>

                  {/* DEX */}
                  <td className={`py-1 px-2 text-right text-sm xl:text-base ${
                    strike.dex > 0 ? 'text-green-600' :
                    strike.dex < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatExposure(strike.dex)}
                  </td>

                  {/* Open Interest */}
                  <td className="py-1 px-2 text-right text-gray-600 text-sm xl:text-base">
                    {formatExposure(strike.call_oi + strike.put_oi)}
                  </td>

                  {/* Terrain & Flags */}
                  <td className="py-1 px-2">
                    <div className="max-w-24 xl:max-w-32">
                      <div className="text-xs xl:text-sm truncate" title={strike.classification}>
                        {strike.classification.split(' — ')[0]}
                      </div>
                      {strike.pattern_flags.length > 0 && isSpotStrike && (
                        <div className="mt-1 space-x-1">
                          {strike.pattern_flags.map(flag => (
                            <span
                              key={flag}
                              className="inline-block px-1 py-0.5 text-xs xl:text-sm bg-red-100 text-red-800 rounded font-medium"
                            >
                              ALERT: {flag.replace('MAX_DOWNSIDE_', 'MAX ')}
                            </span>
                          ))}
                        </div>
                      )}
                      {strike.pattern_flags.length > 0 && !isSpotStrike && (
                        <div className="mt-1 text-xs xl:text-sm text-gray-600 italic">
                          Pattern detected
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