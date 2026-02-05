import { useState, useEffect } from 'react';
import StructuralView from './components/StructuralView';
import DTEView from './components/0DTEView';
import MarketClock from './components/MarketClock';
import { useApiPolling } from './hooks/useApiPolling';
import type { ExposuresResponse, ExposuresMatrixResponse, ExpirationsResponse } from './types/api';

function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'structural' | '0dte'>('structural');

  // Control states (for structural view)
  const [expiration, setExpiration] = useState<string>('ALL'); // Start with ALL expirations view
  const [metric, setMetric] = useState<'GEX' | 'DEX' | 'VEX' | 'CEX'>('GEX');
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10 seconds for dynamic alerts
  const [vixRegime, setVixRegime] = useState<'RISING' | 'FALLING' | 'AUTO'>('AUTO');

  // Data states
  const [exposuresData, setExposuresData] = useState<ExposuresResponse | null>(null);
  const [matrixData, setMatrixData] = useState<ExposuresMatrixResponse | null>(null);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  // Initialize polling hook
  const { startPolling, stopPolling } = useApiPolling({
    refreshInterval,
    onData: (data) => {

      if (activeTab === 'structural') {
        // Structural tab: set both exposures and matrix data as before
        if (expiration === 'ALL') {
          setMatrixData(data.matrixData);
        } else {
          setMatrixData(null);
        }
        setExposuresData(data.exposuresData);
      } else if (activeTab === '0dte') {
        // 0DTE tab: only set exposures data, clear matrix data
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
        setExpirations(expData.expirations || []);

          // Set first available expiration if we don't have one set
          // Skip today's date as it might not have options data yet
          if (expData.expirations && expData.expirations.length > 0) {
            // Use US/Eastern timezone for trading dates (Roberto is in US)
            const today = new Date().toLocaleDateString('en-CA', {
              timeZone: 'America/New_York'
            }); // YYYY-MM-DD format in US/Eastern
            let firstExpiration = expData.expirations[0];

          // If first expiration is today, skip to next available
          if (firstExpiration === today && expData.expirations.length > 1) {
            firstExpiration = expData.expirations[1];
            console.log('📅 Skipped today\'s date, using next available expiration:', firstExpiration);
          } else {
            console.log('📅 Set first available expiration:', firstExpiration);
          }

          setExpiration(firstExpiration);
        }
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

  // Handle all polling for both tabs
  useEffect(() => {
    // Stop polling first to clear any existing polling
    stopPolling();

    if (activeTab === 'structural') {
      // Structure tab polling - restart whenever relevant params change
      if (expirations.length > 0 && expiration) {
        startPolling(expiration, metric, vixRegime, 'ALL', refreshInterval);
      }
    } else if (activeTab === '0dte') {
      // 0DTE tab polling - use today's date for single expiration (not ALL)
      // 0DTE should refresh at 1s intervals as per specification
      // Use US/Eastern timezone for trading dates (Roberto is in US)
      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      }); // YYYY-MM-DD format in US/Eastern
      startPolling(today, metric, 'AUTO', '0DTE', 1000); // 1 second refresh
    }
  }, [activeTab, expiration, metric, vixRegime, refreshInterval, expirations?.length || 0]);

  // Reset data when switching tabs to prevent stale data
  useEffect(() => {
    setLoading(true);
    setError(null);
    setExposuresData(null);
    setMatrixData(null);
  }, [activeTab]);

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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                SPX Market Maker Greek Exposures
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Real-time GEX/DEX/VEX/CEX analysis with regime classification
              </p>
            </div>

            {/* Market Clock - Responsive positioning */}
            <div className="flex-shrink-0 self-start sm:self-auto">
              <MarketClock />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('structural')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'structural'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Structure (All Expirations)
            </button>
            <button
              onClick={() => setActiveTab('0dte')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === '0dte'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              0DTE (SPXW)
            </button>
          </nav>
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

      {/* Main Content - Tabbed Views */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'structural' ? (
          <StructuralView
            expiration={expiration}
            metric={metric}
            refreshInterval={refreshInterval}
            vixRegime={vixRegime}
            expirations={expirations}
            loading={loading}
            exposuresData={exposuresData}
            matrixData={matrixData}
            onControlsChange={handleControlsChange}
          />
        ) : (
          <DTEView
            activeTab={activeTab}
            exposuresData={exposuresData}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

export default App;