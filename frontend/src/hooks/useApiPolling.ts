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
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInProgressRef = useRef<boolean>(false);

  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

  const fetchData = useCallback(async (
    expiration: string,
    metric: MetricType,
    vixRegime: VixRegimeType,
    mode: string = 'ALL'
  ) => {
    // Skip if a request is already in progress
    if (isRequestInProgressRef.current) {
      console.log('⏸️ Skipping fetch - request already in progress');
      return;
    }

    isRequestInProgressRef.current = true;
    console.log('🔄 fetchData called:', { expiration, metric, vixRegime });

    // Check if we can make requests
    if (typeof fetch === 'undefined') {
      console.error('❌ fetch API not available');
      onError('Network API not available');
      isRequestInProgressRef.current = false;
      return;
    }

    try {
      // Fetch exposures data (removed AbortController to avoid race conditions)
      const instrument = mode === '0DTE' ? 'SPXW' : 'SPX';  // Explicit instrument selection
      const exposuresUrl = `${apiBaseUrl}/api/exposures?expiration=${expiration}&vix_regime=${vixRegime}&mode=${mode}&instrument=${instrument}`;
      console.log('🚀 Starting fetch for:', exposuresUrl);

      let exposuresResponse: Response;
      try {
        exposuresResponse = await fetch(exposuresUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
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

        try {
          const matrixResponse = await fetch(matrixUrl, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

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
          console.error('❌ Matrix fetch error:', matrixError);
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
    } catch (error) {
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
    }
  }, [apiBaseUrl, onData, onError]);

  const startPolling = useCallback((
    expiration: string,
    metric: MetricType,
    vixRegime: VixRegimeType,
    mode: string = 'ALL'
  ) => {
    // Stop any existing polling
    stopPolling();

    // Fetch immediately
    fetchData(expiration, metric, vixRegime, mode);

    // Start interval polling
    intervalRef.current = setInterval(() => {
      fetchData(expiration, metric, vixRegime, mode);
    }, refreshInterval);
  }, [fetchData, refreshInterval, mode]);

  const stopPolling = useCallback(() => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset request flag
    isRequestInProgressRef.current = false;
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  return { startPolling, stopPolling, cleanup };
}