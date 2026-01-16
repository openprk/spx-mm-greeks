import { useState, useEffect, useRef } from 'react';
import Heatmap from './components/Heatmap';
import Controls from './components/Controls';
import Legend from './components/Legend';
import ConductivityCard from './components/ConductivityCard';
import TerrainTable from './components/TerrainTable';
import { useApiPolling } from './hooks/useApiPolling';
import type { ExposuresResponse, ExposuresMatrixResponse, ExpirationsResponse } from './types/api';

function App() {
  // Control states
  const [expiration, setExpiration] = useState<string>('2026-01-16'); // Will be updated to first available
  const [metric, setMetric] = useState<'GEX' | 'DEX' | 'VEX' | 'CEX'>('GEX');
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds
  const [vixRegime, setVixRegime] = useState<'RISING' | 'FALLING' | 'AUTO'>('AUTO');

  // Data states
  const [exposuresData, setExposuresData] = useState<ExposuresResponse | null>(null);
  const [matrixData, setMatrixData] = useState<ExposuresMatrixResponse | null>(null);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate polling starts
  const lastPollingParamsRef = useRef<string>('');

  // Initialize polling hook
  const { startPolling, stopPolling } = useApiPolling({
    refreshInterval,
    onData: (data) => {
      console.log('🎯 onData received:', {
        hasExposuresData: !!data.exposuresData,
        hasMatrixData: !!data.matrixData,
        exposuresDataKeys: data.exposuresData ? Object.keys(data.exposuresData) : null,
        matrixDataKeys: data.matrixData ? Object.keys(data.matrixData) : null,
        expiration,
        timestamp: new Date().toISOString()
      });

      if (data.exposuresData) {
        console.log('✅ Setting exposuresData:', {
          expiration: data.exposuresData.expiration,
          strikesCount: data.exposuresData.strikes?.length || 0
        });
      }

      if (data.matrixData) {
        console.log('✅ Setting matrixData:', {
          hasZ: !!data.matrixData.z,
          expirationsCount: data.matrixData.x_expirations?.length || 0
        });
      }

      if (expiration === 'ALL') {
        setMatrixData(data.matrixData);
        setExposuresData(data.exposuresData);
      } else {
        setExposuresData(data.exposuresData);
        setMatrixData(null);
      }
      setLoading(false);
      setError(null);
    },
    onError: (err) => {
      console.error('❌ App onError called:', err);
      setError(err);
      setLoading(false);
    }
  });

  // Load initial data (only expirations)
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('📡 Loading initial expirations data...');
      try {
        // Load expirations
        const apiUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
        const expUrl = `${apiUrl}/api/expirations`;
        console.log('📡 Fetching expirations from:', expUrl);
        const expResponse = await fetch(expUrl);
        console.log('📡 Expirations response:', { status: expResponse.status, ok: expResponse.ok });
        const expData: ExpirationsResponse = await expResponse.json();
        console.log('📦 Expirations data:', expData);
        setExpirations(expData.expirations);
      } catch (err) {
        console.error('❌ Failed to load initial data:', err);
        setError('Failed to load initial data');
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Set first expiration when expirations load
  useEffect(() => {
    console.log('📅 Setting first expiration:', { expirations, currentExpiration: expiration });
    if (expirations.length > 0 && expiration === '2026-01-16') {
      const firstExpiration = expirations[0] || '2026-01-16';
      console.log('📅 Setting expiration to:', firstExpiration);
      setExpiration(firstExpiration);
    }
  }, [expirations]);

  // Handle all polling (initial and changes)
  useEffect(() => {
    // Start polling when we have expirations loaded and a valid expiration
    const pollingParams = `${expiration}-${metric}-${vixRegime}`;

    console.log('🔄 Polling useEffect triggered:', {
      expirationsLength: expirations.length,
      expiration,
      metric,
      vixRegime,
      refreshInterval,
      loading,
      hasExpirations: expirations.length > 0,
      hasExpiration: !!expiration,
      lastParams: lastPollingParamsRef.current,
      newParams: pollingParams
    });

    if (expirations.length > 0 && expiration && pollingParams !== lastPollingParamsRef.current) {
      console.log('▶️ Starting polling with params:', { expiration, metric, vixRegime });
      lastPollingParamsRef.current = pollingParams;
      stopPolling();
      startPolling(expiration, metric, vixRegime);
    } else if (expirations.length === 0 || !expiration) {
      console.log('⏸️ Not starting polling - conditions not met:', {
        reason: expirations.length === 0 ? 'no expirations loaded' : 'no expiration set'
      });
    } else {
      console.log('⏸️ Skipping polling - same parameters as last time');
    }
  }, [expiration, metric, vixRegime, refreshInterval, expirations.length, startPolling, stopPolling]);

  const handleControlsChange = (
    newExpiration: string,
    newMetric: typeof metric,
    newRefreshInterval: number,
    newVixRegime: typeof vixRegime
  ) => {
    setExpiration(newExpiration);
    setMetric(newMetric);
    setRefreshInterval(newRefreshInterval);
    setVixRegime(newVixRegime);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            SPX Market Maker Greek Exposures
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time GEX/DEX/VEX/CEX analysis with regime classification
          </p>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Controls
            expiration={expiration}
            metric={metric}
            refreshInterval={refreshInterval}
            vixRegime={vixRegime}
            expirations={expirations}
            onChange={handleControlsChange}
            loading={loading}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800 text-sm">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Heatmap - takes up most space */}
          <div className="flex-1 xl:flex-[3]">
            <div className="card h-auto">
              <Heatmap
                matrixData={matrixData}
                exposuresData={exposuresData}
                metric={metric}
                expiration={expiration}
                loading={loading}
              />
            </div>
          </div>

          {/* Sidebar - fixed width on large screens */}
          <div className="w-full xl:w-96 xl:min-w-96 space-y-6">
            {/* Conductivity Card */}
            <ConductivityCard
              exposuresData={exposuresData}
              loading={loading}
            />

            {/* Legend */}
            <Legend />

            {/* Terrain Table */}
            <TerrainTable
              exposuresData={exposuresData}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;