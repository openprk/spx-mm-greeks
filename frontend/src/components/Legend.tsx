import React from 'react';
import type { ExposuresResponse, MarketAlert } from '../types/api';

interface LegendProps {
  exposuresData?: ExposuresResponse | null;
}

// Alert styling based on risk level and context
const getAlertStyling = (alert: MarketAlert) => {
  // For LEVEL_APPROACHING alerts, style based on regime context
  if (alert.type === 'LEVEL_APPROACHING') {
    const regimeContext = alert.regime_context || 'neutral';
    switch (regimeContext) {
      case 'bullish':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-700',
          icon: '📈'
        };
      case 'bearish':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700',
          icon: '📉'
        };
      case 'volatile':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-700',
          icon: '⚡'
        };
      default: // neutral
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          icon: 'ℹ️'
        };
    }
  }

  // Legacy string-based alerts (for backward compatibility)
  const alertString = typeof alert === 'string' ? alert : alert.type;

  // High-risk alerts (red)
  const highRiskAlerts = [
    'MAX_DOWNSIDE_ACCELERATION', 'MAX_RISK_0DTE_SETUP', 'EXTREME_0DTE_RISK_SETUP',
    'VOLATILE_RESISTANCE_PIN_RISK', 'VOLATILE_SUPPORT_PIN_RISK', 'BEARISH_BREAKDOWN_IMMINENT',
    'CRITICAL_TIME_DECAY_WINDOW'
  ];

  // Opportunity alerts (green)
  const opportunityAlerts = [
    'BULLISH_BREAKOUT_IMMINENT', 'BOUNCE_CANDIDATE_ACTIVE', 'TIME_DECAY_BREAKOUT_OPPORTUNITY',
    'BULLISH_SUPPORT_DEFENSE_STRONG', 'HIGH_PROBABILITY_0DTE_PIN'
  ];

  // Caution alerts (yellow/orange)
  const cautionAlerts = [
    'VOL_CUSHION_TRAP_ACTIVE', 'COMPRESSION_TEST_OF_RESISTANCE', 'ACCELERATION_TEST_OF_SUPPORT',
    'BEARISH_RESISTANCE_REJECTION_LIKELY', 'VIX_SPIKE_AMPLIFYING_VOLATILITY'
  ];

  if (highRiskAlerts.includes(alertString)) {
    return {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      icon: '🚨'
    };
  } else if (opportunityAlerts.includes(alertString)) {
    return {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      icon: '💹'
    };
  } else if (cautionAlerts.includes(alertString)) {
    return {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      icon: '⚠️'
    };
  } else {
    // Default informational alerts
    return {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      icon: 'ℹ️'
    };
  }
};

// Generate display name from alert object or string
const getAlertDisplayName = (alert: MarketAlert | string): string => {
  // Handle MarketAlert objects
  if (typeof alert === 'object' && alert.type) {
    if (alert.type === 'LEVEL_APPROACHING') {
      const regime = (alert.regime_context || 'neutral').toUpperCase();
      const side = (alert.side || 'unknown').toUpperCase();
      return `${regime} ${side} APPROACH`;
    }
    // For other alert types, use the type field
    return alert.type.replace(/_/g, ' ');
  }

  // Handle legacy string alerts
  if (typeof alert === 'string') {
    return alert.replace(/_/g, ' ');
  }

  // Fallback
  return 'Unknown Alert';
};

// Intelligent alert descriptions based on regime + spot price context
const getAlertDescription = (alert: MarketAlert | string): string => {
  // Handle string alerts directly
  if (typeof alert === 'string') {
    const descriptions: Record<string, string> = {
    // Regime-specific pattern alerts
    'MAX_DOWNSIDE_ACCELERATION': 'Extreme bearish alignment (G- D- V- C+) indicating maximum downward momentum acceleration',
    'COMPRESSION_PIN_SETUP': 'Bullish compression regime (G+ D+ V+ C-) creating pin behavior potential',
    'VOL_CUSHION_TRAP_ACTIVE': 'Bearish momentum with volatility buffer (G- D- V+ C-) creating trap risk',
    'BOUNCE_CANDIDATE_ACTIVE': 'Reversal setup with buying pressure (G+ D+ V- C+) favoring upside bounce',

    // Contextual resistance alerts
    'BULLISH_BREAKOUT_IMMINENT': 'Bullish regime at resistance - breakout likely with strong momentum',
    'COMPRESSION_TEST_OF_RESISTANCE': 'Compression regime approaching resistance - pin behavior expected',
    'BEARISH_RESISTANCE_REJECTION_LIKELY': 'Bearish regime at resistance - rejection and continued decline probable',
    'VOLATILE_RESISTANCE_PIN_RISK': 'High volatility at resistance - increased pin risk with wider moves',

    // Contextual support alerts
    'BEARISH_BREAKDOWN_IMMINENT': 'Bearish regime at support - breakdown likely with accelerated selling',
    'ACCELERATION_TEST_OF_SUPPORT': 'Acceleration regime testing support - breakdown probability high',
    'BULLISH_SUPPORT_DEFENSE_STRONG': 'Bullish regime defending support - bounce likely with buying pressure',
    'VOLATILE_SUPPORT_PIN_RISK': 'High volatility at support - increased pin risk with wider moves',

    // VIX context alerts
    'VIX_SPIKE_AMPLIFYING_VOLATILITY': 'Rising VIX amplifying volatility regime - expect larger moves',
    'VIX_CALM_SUPPORTING_UPSIDE': 'Falling VIX supporting bullish regime - favorable for upside',

    // 0DTE-specific alerts
    'TRADING_0DTE_SESSION': 'Currently in 0DTE trading session with heightened sensitivity',
    'EARLY_0DTE_LOW_RISK_PERIOD': 'Early 0DTE session - lower risk, time decay minimal impact',
    'LATE_0DTE_HIGH_RISK_PERIOD': 'Late 0DTE session - higher risk, time decay critical',
    'MID_0DTE_ACTIVE_PERIOD': 'Mid 0DTE session - active trading with building time decay',
    'CRITICAL_TIME_DECAY_WINDOW': 'Time decay becoming critical in late 0DTE session',

    // High-risk combinations
    'MAX_RISK_0DTE_SETUP': 'Extreme risk setup in 0DTE - avoid large positions',
    'EXTREME_0DTE_RISK_SETUP': 'Maximum acceleration in 0DTE - extreme caution required',
    'HIGH_PROBABILITY_0DTE_PIN': 'High probability pin setup in 0DTE compression regime',
    '0DTE_EXTREME_REGIME_RISK': 'Extreme regime conditions in 0DTE session - monitor closely',

    // Time decay opportunities
    'TIME_DECAY_BREAKOUT_OPPORTUNITY': 'Time decay aligning with bullish breakout setup',

    // Generic fallbacks
    'NEUTRAL_RESISTANCE_APPROACH': 'Approaching resistance in neutral regime - monitor for direction',
    'NEUTRAL_SUPPORT_APPROACH': 'Approaching support in neutral regime - monitor for direction',
    'MOMENTUM_WITH_VOLATILITY_BUFFER': 'Momentum present but volatility provides cushioning effect'
    };

    return descriptions[alert] || 'Contextual market alert condition detected';
  }

  // Handle MarketAlert objects
  if (typeof alert === 'object' && alert.type) {
    if (alert.type === 'LEVEL_APPROACHING') {
      const side = alert.side || 'unknown';
      const regime = alert.regime_context || 'neutral';
      const distancePct = alert.distance_pct ? `${alert.distance_pct}%` : 'close proximity';
      const distancePoints = alert.distance_points ? `${alert.distance_points} points` : '';

      let description = `Approaching ${side} in ${regime} regime`;
      if (distancePoints) {
        description += ` (${distancePct} / ${distancePoints})`;
      }
      description += ' - monitor for direction';

      return description;
    }

    // Handle other structured alert types here as needed
    if (alert.type === 'SPOT_PATTERN_CRITICAL') {
      return 'Critical pattern detected at spot strike - extreme caution required';
    }
    if (alert.type === 'VOL_REGIME') {
      return 'Volatility regime change detected - monitor for volatility expansion';
    }
    if (alert.type === '0DTE_SESSION_STATUS') {
      return '0DTE session status alert - heightened sensitivity period';
    }
    if (alert.type === 'STRIKE_EXTREMES') {
      return 'Strike extremes reached - potential reversal or acceleration';
    }
  }

  // Fallback
  return 'Contextual market alert condition detected';
};

const Legend: React.FC<LegendProps> = ({ exposuresData }) => {
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
        <div className="text-xs space-y-2 max-h-64 overflow-y-auto">
          {/* Core Terrain Classifications (Guide-Specified) */}
          <div className="border-l-2 border-blue-400 pl-2">
            <strong className="text-blue-600">G+ D+ V+ C-</strong><br/>
            <span className="text-gray-600">CEILING/MAGNET — Extreme compression + directional buying support. Pin behavior expected.</span>
          </div>
          <div className="border-l-2 border-red-400 pl-2">
            <strong className="text-red-600">G- D- V- C+</strong><br/>
            <span className="text-gray-600">ACCELERATION ZONE (DOWN) — All directional Greeks aligned bearish. No support structure.</span>
          </div>
          <div className="border-l-2 border-orange-400 pl-2">
            <strong className="text-orange-600">G- D- V+ C-</strong><br/>
            <span className="text-gray-600">HIGH-VELOCITY DOWN — Momentum amplified, but VEX provides vol-spike cushion. Trapped longs above.</span>
          </div>
          <div className="border-l-2 border-green-400 pl-2">
            <strong className="text-green-600">G+ D+ V- C+</strong><br/>
            <span className="text-gray-600">BOUNCE CANDIDATE — Compression + buying pressure + vol-spike cushion. Reversal setup zone.</span>
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
          <div className="bg-red-50 p-2 rounded border-l-4 border-red-400">
            <strong className="text-red-700">ACCELERATION_DOWN</strong><br/>
            <span className="text-gray-600">Extreme bearish alignment - maximum downward acceleration</span>
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
            <div><strong>GEX:</strong> Billions (K = thousands of $M) - Gamma exposure per 1% move</div>
            <div><strong>DEX:</strong> Billions (K = thousands of $M) - Delta exposure per 1% move</div>
            <div><strong>VEX:</strong> Billions (K = thousands of $M) - Vanna exposure per 1% move</div>
            <div><strong>CEX:</strong> Billions (K = thousands of $M) - Charm exposure per 1% move</div>
          </div>
          <p className="mt-2 text-gray-600">
            Negative values indicate market makers are positioned against that direction.
          </p>
        </div>
      </div>


      {/* Active Market Alerts */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Active Market Alerts</h4>
        {((exposuresData?.aggregate?.market_alerts && exposuresData.aggregate.market_alerts.length > 0) ||
          (exposuresData?.strikes && exposuresData.strikes.some(strike => strike.pattern_flags.length > 0))) ? (
          <div className="space-y-2">
            {/* Aggregate Market Alerts - Dynamic based on regime */}
            {exposuresData?.aggregate?.market_alerts?.map((alert, index) => {
              const alertStyle = getAlertStyling(alert);
              return (
                <div key={`market-${index}`} className={`text-xs p-2 rounded border ${alertStyle.bgColor} ${alertStyle.borderColor}`}>
                  <div className="flex items-center">
                    <span className={`font-medium ${alertStyle.textColor}`}>{alertStyle.icon} {getAlertDisplayName(alert)}</span>
                  </div>
                  <p className="text-gray-600 mt-1">
                    {getAlertDescription(alert)}
                  </p>
                </div>
              );
            })}

            {/* Strike-Level Alerts - Guide compliant */}
            {exposuresData?.strikes
              ?.filter(strike => strike.pattern_flags.length > 0)
              .flatMap(strike => strike.pattern_flags)
              .filter((flag, index, arr) => arr.indexOf(flag) === index)
              .map((alert, index) => (
                <div key={`strike-${index}`} className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                  <div className="flex items-center">
                    <span className="text-yellow-600 font-medium">⚠️ {alert.replace('MAX_DOWNSIDE_', 'MAX ')}</span>
                  </div>
                  <p className="text-gray-600 mt-1">
                    {alert === 'MAX_DOWNSIDE_ACCELERATION'
                      ? 'Extreme bearish alignment (G- D- V- C+) detected at individual strike level'
                      : alert === 'EXTREME_GAMMA_EXPOSURE_BULLISH'
                      ? 'Extreme bullish gamma exposure (&gt;1M) at this strike - strong upside hedging'
                      : alert === 'EXTREME_GAMMA_EXPOSURE_BEARISH'
                      ? 'Extreme bearish gamma exposure (&lt;-1M) at this strike - strong downside hedging'
                      : alert === 'HIGH_GAMMA_EXPOSURE_BULLISH'
                      ? 'High bullish gamma exposure (&gt;500K) at this strike - notable upside hedging'
                      : alert === 'HIGH_GAMMA_EXPOSURE_BEARISH'
                      ? 'High bearish gamma exposure (&lt;-500K) at this strike - notable downside hedging'
                      : alert === 'HIGH_DELTA_EXPOSURE_BULLISH'
                      ? 'High bullish delta exposure (&gt;500K) at this strike - market maker upside positioning'
                      : alert === 'HIGH_DELTA_EXPOSURE_BEARISH'
                      ? 'High bearish delta exposure (&lt;-500K) at this strike - market maker downside positioning'
                      : alert === 'HIGH_VEGA_EXPOSURE'
                      ? 'High vega exposure (&gt;200K) at this strike - significant volatility sensitivity'
                      : 'Guide-specified alert condition detected'
                    }
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-xs bg-green-50 p-2 rounded border border-green-200">
            <div className="flex items-center">
              <span className="text-green-600 font-medium">✅ No Active Alerts</span>
            </div>
            <p className="text-gray-600 mt-1">
              Current market conditions show no extreme positioning alerts
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Legend;