import { useRef, useCallback } from 'react';
import type { ExposuresResponse, ExposuresMatrixResponse, MetricType, VixRegimeType } from '../types/api';

interface UseApiPollingOptions {
  refreshInterval: number;
  mode?: string;
  onData: (data: {
    exposuresData: ExposuresResponse;
    matrixData: ExposuresMatrixResponse | null;
  }) => void;
  onError: (error: string) => void;
}

export function useApiPolling({ refreshInterval, mode = 'ALL', onData, onError }: UseApiPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestInProgressRef = useRef<boolean>(false);
  const isFetchQueuedRef = useRef<boolean>(false);

  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

  const fetchData = useCallback(async (
    expiration: string,
    metric: MetricType,
    vixRegime: VixRegimeType,
    mode: string = 'ALL'
  ) => {
    // NOTE: Flag management is handled by performFetch - this function only does HTTP requests

    // Check if we can make requests
    if (typeof fetch === 'undefined') {
      throw new Error('Network API not available');
    }

    // Fetch exposures data
    const instrument = mode === '0DTE' ? 'SPXW' : 'SPX';  // Explicit instrument selection
    const exposuresUrl = `${apiBaseUrl}/api/exposures?expiration=${expiration}&vix_regime=${vixRegime}&mode=${mode}&instrument=${instrument}`;
    console.log('🚀 Starting fetch for:', exposuresUrl);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for heavy backend processing

    let exposuresResponse: Response;
    try {
      exposuresResponse = await fetch(exposuresUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timeout - API took too long to respond');
      }
      console.error('❌ Network error fetching exposures:', fetchError);
      throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown network error'}`);
    }

    console.log('📡 Exposures response received:', { status: exposuresResponse.status, ok: exposuresResponse.ok });

    if (!exposuresResponse.ok) {
      const errorText = await exposuresResponse.text();
      console.error('❌ Exposures API error response:', errorText);
      throw new Error(`Exposures API error ${exposuresResponse.status}: ${errorText}`);
    }

    let exposuresData: ExposuresResponse;
    try {
      exposuresData = await exposuresResponse.json();
    } catch (parseError) {
      console.error('❌ JSON parse error for exposures:', parseError);
      throw new Error('Failed to parse exposures response as JSON');
    }

    console.log('📦 Exposures data received:', {
      expiration: exposuresData.expiration,
      strikesCount: exposuresData.strikes?.length || 0,
      hasAggregate: !!exposuresData.aggregate
    });

    let matrixData: ExposuresMatrixResponse | null = null;

    // Fetch matrix data if expiration is ALL
    if (expiration === 'ALL') {
      const matrixInstrument = mode === '0DTE' ? 'SPXW' : 'SPX';  // Explicit instrument selection
      const matrixUrl = `${apiBaseUrl}/api/exposures_matrix?metric=${metric}&vix_regime=${vixRegime}&mode=${mode}&instrument=${matrixInstrument}`;
      console.log('📊 Fetching matrix data from:', matrixUrl);

      // Create AbortController for matrix timeout
      const matrixController = new AbortController();
      const matrixTimeoutId = setTimeout(() => matrixController.abort(), 60000); // 60 second timeout for heavy processing

      try {
        const matrixResponse = await fetch(matrixUrl, {
          signal: matrixController.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        clearTimeout(matrixTimeoutId);

        if (matrixResponse.ok) {
          matrixData = await matrixResponse.json();
          console.log('📊 Matrix data received:', {
            hasZ: !!(matrixData as any)?.z,
            zLength: (matrixData as any)?.z?.length || 0,
            expirationsCount: (matrixData as any)?.x_expirations?.length || 0,
            strikesCount: (matrixData as any)?.y_strikes?.length || 0
          });
        } else {
          const errorText = await matrixResponse.text();
          console.warn('❌ Matrix data not available:', matrixResponse.status, errorText);
        }
      } catch (matrixError) {
        clearTimeout(matrixTimeoutId);
        if (matrixError instanceof Error && matrixError.name === 'AbortError') {
          console.warn('⚠️ Matrix request timeout');
        } else {
          console.error('❌ Matrix fetch error:', matrixError);
        }
        // Don't fail the whole request if matrix fails
      }
    }

    console.log('🎯 About to call onData with:', {
      hasExposuresData: !!exposuresData,
      hasMatrixData: !!matrixData,
      exposuresDataKeys: exposuresData ? Object.keys(exposuresData) : null,
      matrixDataKeys: matrixData ? Object.keys(matrixData) : null
    });
    onData({ exposuresData, matrixData });
  }, [apiBaseUrl, onData]);

  const startPolling = useCallback((
    expiration: string,
    metric: MetricType,
    vixRegime: VixRegimeType,
    mode: string = 'ALL',
    customRefreshInterval?: number
  ) => {
    // Stop any existing polling
    stopPolling();

    // Use custom interval if provided, otherwise use default
    const intervalMs = customRefreshInterval ?? refreshInterval;
    console.log(`⏰ Starting polling with ${intervalMs}ms interval for ${expiration} (${mode})`);

    // Function to perform fetch with queuing logic
    const performFetch = async () => {
      // Skip if already fetching
      if (isRequestInProgressRef.current) {
        console.log('⏸️ Skipping fetch - request already in progress');
        return;
      }

      isRequestInProgressRef.current = true;
      console.log('🔄 Starting fetch operation:', { expiration, metric, vixRegime });

      try {
        await fetchData(expiration, metric, vixRegime, mode);
      } catch (error) {
        // Handle errors from fetchData
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log('⏹️ Request was cancelled');
            return;
          }

          // Check if it's a service unavailable error (no market data)
          if (error.message.includes('503') || error.message.includes('Service Unavailable') ||
              error.message.includes('No options market data available')) {
            console.error('🚫 Market Data Unavailable:', error.message);
            onError('Market data temporarily unavailable. Options data is not accessible at this time.');
          } else {
            console.error('❌ API Error:', error.message);
            onError(error.message);
          }
        } else {
          console.error('❌ Unknown error:', error);
          onError('Unknown error occurred');
        }
      } finally {
        isRequestInProgressRef.current = false;

        // If a fetch was queued while this one was running, execute it now
        if (isFetchQueuedRef.current) {
          isFetchQueuedRef.current = false;
          console.log('📋 Executing queued fetch');
          // Execute synchronously to avoid zombie timeouts
          performFetch();
        }
      }
    };

    // Start continuous interval polling
    intervalRef.current = setInterval(() => {
      console.log(`⏱️ Interval triggered (${intervalMs}ms) - checking request status`);
      if (isRequestInProgressRef.current) {
        // Queue the fetch for when current request completes
        isFetchQueuedRef.current = true;
        console.log('📋 Fetch queued - will execute when current request completes');
      } else {
        // No request in progress, fetch immediately
        performFetch();
      }
    }, intervalMs);

    // Perform initial fetch immediately
    performFetch();
  }, [fetchData, refreshInterval, mode]);

  const stopPolling = useCallback(() => {
    console.log('🛑 Stopping polling');

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Note: With synchronous queuing, no pending timeouts to clear

    // Reset request flag and queued fetch flag
    isRequestInProgressRef.current = false;
    isFetchQueuedRef.current = false;

    console.log('✅ Polling stopped and cleaned up');
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  return { startPolling, stopPolling, cleanup };
}