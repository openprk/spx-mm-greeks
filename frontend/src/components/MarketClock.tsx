import React, { useState, useEffect, useMemo } from 'react';

interface MarketClockData {
  clock: {
    state: string;
    date: string;
    description: string;
    timestamp: number;  // Unix timestamp in seconds
    next_change?: string;
    next_state?: string;
  };
}

interface CalendarData {
  calendar: {
    month: number;
    year: number;
    days: {
      day: any[]; // Tradier nests the days array under "day" property
    };
  };
}

const MarketClock: React.FC = () => {
  // Force recompile with updated code - v2
  const [clockData, setClockData] = useState<MarketClockData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchClock = async () => {
    try {
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBaseUrl}/api/clock`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setClockData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = async () => {
    try {
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
      const currentYear = now.getFullYear();

      const response = await fetch(`${apiBaseUrl}/api/calendar?month=${currentMonth}&year=${currentYear}`);
      if (!response.ok) {
        throw new Error(`Calendar HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('Calendar data received:', data); // Debug logging
      setCalendarData(data);
    } catch (err) {
      console.warn('Failed to fetch calendar data:', err);
      // Don't set main error for calendar failures - it's not critical
    }
  };

  useEffect(() => {
    fetchClock();
    fetchCalendar();

    // Update market data every 30 seconds
    const marketInterval = setInterval(fetchClock, 30000);

    // Update live time every second
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(marketInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'premarket':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'postmarket':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (timestamp: number | string) => {
    try {
      // Handle Unix timestamp (seconds) vs ISO string
      const date = typeof timestamp === 'number'
        ? new Date(timestamp * 1000)  // Convert Unix seconds to milliseconds
        : new Date(timestamp);

      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('formatTime error:', error, 'for timestamp:', timestamp);
      return String(timestamp);
    }
  };

  const nextTradingDay = useMemo(() => {
    if (!calendarData?.calendar?.days?.day || !Array.isArray(calendarData.calendar.days.day)) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    try {
      // Find next trading day (open or early_close status)
      for (const day of calendarData.calendar.days.day) {
        if (day && typeof day === 'object' && day.date && day.status) {
          if (day.date > today && (day.status === 'open' || day.status === 'early_close')) {
            // Always skip today - we want the NEXT trading day
            return {
              date: day.date,
              status: day.status,
              description: day.description || 'Trading day'
            };
          }
        }
      }
    } catch (error) {
      console.warn('Error processing calendar data:', error);
      return null;
    }

    return null;
  }, [calendarData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !clockData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <div className="text-xs text-gray-500 mb-1">Market Clock</div>
        <div className="text-red-600 text-sm">
          {error || 'No data'}
        </div>
      </div>
    );
  }

  const { clock } = clockData;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="text-xs text-gray-500 mb-1">Market Clock</div>

      {/* Current Status */}
      <div className="mb-2">
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(clock.state)}`}>
          {clock.state.toUpperCase()}
        </div>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-700 mb-2">
        {clock.description}
      </div>

      {/* Date and Time */}
      <div className="text-xs text-gray-600">
        <div>Date: {new Date(clock.date).toLocaleDateString()}</div>
        <div>Time: {formatTime(currentTime.toISOString())}</div>
        <div className="text-gray-500">Last updated: {formatTime(clock.timestamp)}</div>
      </div>

      {/* Next Events Section */}
      {(() => {
        const hasNextEvent = clock.next_change || clock.next_state || nextTradingDay;

        if (!hasNextEvent) return null;

        return (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-1">
              {clock.next_change && clock.next_state && (
                <div>Next: {clock.next_change} ({clock.next_state})</div>
              )}
              {nextTradingDay && nextTradingDay.date !== clock.date && (
                <div className="text-blue-600">
                  Next Trading Day: {new Date(nextTradingDay.date).toLocaleDateString()}
                  {nextTradingDay.status === 'early_close' && ' (Early Close)'}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MarketClock;