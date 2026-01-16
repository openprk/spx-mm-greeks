import React from 'react';

const Legend: React.FC = () => {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>

      {/* Regime Signs */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Regime Signs</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-green-500 rounded mr-2"></span>
            <span>+ Positive</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-red-500 rounded mr-2"></span>
            <span>- Negative</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-gray-400 rounded mr-2"></span>
            <span>o Neutral</span>
          </div>
        </div>
      </div>

      {/* Greeks */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Greeks</h4>
        <div className="space-y-1 text-sm">
          <div><strong>G</strong> = GEX (Gamma Exposure)</div>
          <div><strong>D</strong> = DEX (Delta Exposure)</div>
          <div><strong>V</strong> = VEX (Vanna Exposure)</div>
          <div><strong>C</strong> = CEX (Charm Exposure)</div>
        </div>
      </div>

      {/* GEX Amplifier Principle */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">GEX Amplifier Principle</h4>
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <p className="mb-2">
            <strong>Negative GEX amplifies momentum</strong> in either direction.
          </p>
          <p>
            When GEX is negative, market makers hedge by buying/selling more aggressively,
            creating self-reinforcing moves. Direction is determined by DEX/VEX/CEX alignment.
          </p>
        </div>
      </div>

      {/* Regime Code Format */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Regime Code Format</h4>
        <div className="text-sm font-mono bg-gray-100 p-2 rounded">
          G{'{'}sign{'}'} D{'{'}sign{'}'} V{'{'}sign{'}'} C{'{'}sign{'}'}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Example: G- D+ V o C- (Bearish gamma, bullish delta, neutral vanna, bearish charm)
        </p>
      </div>

      {/* Key Classifications */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Classifications</h4>
        <div className="text-xs space-y-2">
          <div>
            <strong className="text-red-600">G- D- V- C+</strong><br/>
            <span className="text-gray-600">ACCELERATION ZONE (DOWN) - All directional Greeks aligned bearish</span>
          </div>
          <div>
            <strong className="text-orange-600">G- D- V+ C-</strong><br/>
            <span className="text-gray-600">HIGH-VELOCITY DOWN - Momentum amplified with vol cushion</span>
          </div>
          <div>
            <strong className="text-blue-600">G+ D+ V- C+</strong><br/>
            <span className="text-gray-600">STRUCTURAL SUPPORT - Strong compression + buying pressure</span>
          </div>
        </div>
      </div>

      {/* Conductivity Labels */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Conductivity Labels</h4>
        <div className="text-xs space-y-2">
          <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
            <strong className="text-green-700">RALLY-CONDUCIVE</strong><br/>
            <span className="text-gray-600">Bearish alignment favors upside momentum</span>
          </div>
          <div className="bg-red-50 p-2 rounded border-l-4 border-red-400">
            <strong className="text-red-700">SELL-OFF-CONDUCIVE</strong><br/>
            <span className="text-gray-600">Bullish alignment favors downside momentum</span>
          </div>
          <div className="bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
            <strong className="text-yellow-700">CONDITIONAL_VOID</strong><br/>
            <span className="text-gray-600">Accelerates down but cushions volatility spikes</span>
          </div>
          <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-400">
            <strong className="text-blue-700">BOUNCE_CANDIDATE</strong><br/>
            <span className="text-gray-600">Strong compression + buying pressure setup</span>
          </div>
          <div className="bg-gray-50 p-2 rounded border-l-4 border-gray-400">
            <strong className="text-gray-700">MIXED_CHOP</strong><br/>
            <span className="text-gray-600">No clear directional bias - expect range/chop</span>
          </div>
        </div>
      </div>

      {/* Scale Context */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Exposure Scale</h4>
        <div className="text-xs bg-indigo-50 p-3 rounded border border-indigo-200">
          <p className="mb-2">
            <strong>Understanding the numbers:</strong>
          </p>
          <div className="space-y-1">
            <div><strong>GEX:</strong> Trillions (T) - Gamma exposure magnitude</div>
            <div><strong>DEX:</strong> Billions (B) - Delta exposure magnitude</div>
            <div><strong>VEX:</strong> Billions (B) - Vanna exposure magnitude</div>
            <div><strong>CEX:</strong> Billions (B) - Charm exposure magnitude</div>
          </div>
          <p className="mt-2 text-gray-600">
            Negative values indicate market makers are positioned against that direction.
          </p>
        </div>
      </div>

      {/* Alert Patterns */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Alert Patterns</h4>
        <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
          <div className="flex items-center">
            <span className="text-yellow-600 font-medium">⚠️ MAX_DOWNSIDE_ACCELERATION</span>
          </div>
          <p className="text-gray-600 mt-1">
            Extreme bearish alignment (G- D- V- C+) indicating maximum downward momentum
          </p>
        </div>
      </div>
    </div>
  );
};

export default Legend;