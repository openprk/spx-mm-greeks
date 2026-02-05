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
      setCurrentTime(new Date()); // Update time when market data is fetched
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

    // Update market data every 5 minutes (300 seconds) - market state changes infrequently
    const marketInterval = setInterval(fetchClock, 300000);

    // Remove live time polling - browser Date object is accurate enough for display
    // Update time display on market data updates instead

    return () => {
      clearInterval(marketInterval);
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

  const [nextTradingDay, today] = useMemo((): [{ date: string; status: string; description: string } | null, string] => {
    if (!calendarData?.calendar?.days?.day || !Array.isArray(calendarData.calendar.days.day)) {
      return [null, ''];
    }

    // Use UTC date for consistency with calendar/trading data
    const now = new Date();
    const utcISOString = now.toISOString();
    const currentDate = utcISOString.split('T')[0]; // UTC YYYY-MM-DD
    const localDate = now.toLocaleDateString();
    console.log('🗓️ MarketClock Debug:');
    console.log('  - Local time:', now.toLocaleString());
    console.log('  - UTC ISO:', utcISOString);
    console.log('  - Today (UTC):', currentDate);
    console.log('  - Local date:', localDate);
    console.log('📅 MarketClock: Calendar has', calendarData.calendar.days.day.length, 'days');

    try {
      // Find next trading day (open or early_close status) - skip today
      for (const day of calendarData.calendar.days.day) {
        if (day && typeof day === 'object' && day.date && day.status) {
          console.log(`📊 MarketClock: Checking ${day.date} (${day.status}) - Today: ${currentDate}, Compare: ${day.date !== currentDate && day.date > currentDate}`);
          // Strict check: must be AFTER today AND not equal to today AND be a trading day
          if (day.date !== currentDate && day.date > currentDate &&
              (day.status === 'open' || day.status === 'early_close')) {
            console.log('✅ MarketClock: Found next trading day:', day.date, '(today:', currentDate, ')');
            // Double-check that we're not returning today
            if (day.date <= currentDate) {
              console.log('❌ MarketClock: ERROR - Returned date is not after today!');
              continue;
            }
            return [{
              date: day.date,
              status: day.status,
              description: day.description || 'Trading day'
            }, currentDate];
          }
        }
      }
      console.log('❌ MarketClock: No next trading day found in calendar data');
    } catch (error) {
      console.warn('Error processing calendar data:', error);
      return [null, currentDate];
    }

    // If no next trading day found in calendar, assume next weekday (simple fallback)
    if (!nextTradingDay) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Simple weekday check (0=Sunday, 6=Saturday)
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }

      const nextWeekday = tomorrow.toISOString().split('T')[0];
      console.log('🔄 MarketClock: No calendar data, assuming next weekday:', nextWeekday);

      return [{
        date: nextWeekday,
        status: 'open',
        description: 'Assumed trading day (calendar unavailable)'
      }, currentDate];
    }

    return [nextTradingDay, currentDate];
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
      <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 shadow-sm min-w-0 w-full sm:w-auto max-w-xs sm:max-w-none">
        <div className="text-xs sm:text-sm text-gray-500 mb-1">Market Clock</div>
        <div className="text-red-600 text-xs sm:text-sm">
          {error || 'No data'}
        </div>
      </div>
    );
  }

  const { clock } = clockData;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 shadow-sm min-w-0 w-full sm:w-auto max-w-xs sm:max-w-none">
      <div className="text-xs sm:text-sm text-gray-500 mb-1">Market Clock</div>

      {/* Current Status */}
      <div className="mb-2">
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(clock.state)}`}>
          {clock.state.toUpperCase()}
        </div>
      </div>

      {/* Description */}
      <div className="text-xs sm:text-sm text-gray-700 mb-2 leading-tight">
        {clock.description}
      </div>

      {/* Date and Time - Responsive layout */}
      <div className="text-xs sm:text-sm text-gray-600 space-y-0.5">
        <div className="truncate">Date: {(() => {
          const now = new Date();
          const utcDate = now.toISOString().split('T')[0];
          const [year, month, day] = utcDate.split('-');
          return `${month}/${day}/${year}`;
        })()}</div>
        <div className="truncate">Market: {formatTime(new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}))}</div>
        <div className="text-gray-500 truncate text-xs">Local: {formatTime(currentTime.toISOString())}</div>
        <div className="text-gray-500 truncate text-xs">Updated: {formatTime(clock.timestamp)}</div>
      </div>

      {/* Next Events Section */}
      {(() => {
        const hasNextEvent = clock.next_change || clock.next_state || nextTradingDay;

        if (!hasNextEvent) return null;

        return (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs sm:text-sm text-gray-500 space-y-1">
              {clock.next_change && clock.next_state && (
                <div className="truncate">Next: {clock.next_change} ({clock.next_state})</div>
              )}
              {nextTradingDay && nextTradingDay.date !== today && (
                <div className="text-blue-600 text-xs sm:text-sm truncate">
                  Next Trading Day: {(() => {
                    const [year, month, day] = nextTradingDay.date.split('-');
                    return `${month}/${day}/${year}`;
                  })()}
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