'use client';

import { useMemo, memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { HourlyData, Units } from '@/lib/types';
import { formatTemp } from '@/lib/format';
import { useTheme } from '@/lib/ThemeContext';

interface HourlySparklineProps {
  hourlyData: HourlyData[];
  units: Units;
  className?: string;
  titleText?: string;
}

const HourlySparkline = memo(function HourlySparkline({ 
  hourlyData, 
  units, 
  className = ''
}: HourlySparklineProps) {
  const { resolvedTheme } = useTheme();
  const color = '#22d3ee'; // cyan-400
  
  // Colors for axis labels based on theme
  const isDark = resolvedTheme === 'dark';
  const axisTextColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 in dark, slate-500 in light

  // Convert hourly data to chart format with timestamps
  const chartData = useMemo(() => {
    const next24Hours = hourlyData.slice(0, 24);
    const now = Date.now();
    
    return next24Hours.map((data, index) => {
      // Create timestamp for each hour (current time + index hours)
      const timestamp = now + (index * 60 * 60 * 1000);
      return {
        timestamp,
        temperature: data.temperature,
      };
    });
  }, [hourlyData]);

  // Calculate Y-axis domain with padding
  const temperatures = chartData.map(d => d.temperature);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const yDomain = [minTemp * 0.98, maxTemp * 1.02];

  // Format timestamp for tooltip
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Format timestamp for X-axis labels
  function formatXAxisLabel(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: false,
    });
  }

  // Format temperature for Y-axis labels
  function formatYAxisLabel(value: number): string {
    return formatTemp(value, units);
  }


  function CustomTooltip({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      dataKey?: string;
      value?: number;
      payload?: { timestamp: number; temperature: number };
    }>;
  }) {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0]?.payload;
    const hoveredTemp = point?.temperature;
    const ts = point?.timestamp;

    if (typeof hoveredTemp !== 'number' || typeof ts !== 'number') return null;

    return (
      <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm dark:bg-slate-800/95 dark:border-slate-700">
        <div className="mb-1 text-[11px] font-semibold text-gray-800 dark:text-slate-300">
          {formatTimestamp(ts)}
        </div>
        <div className="font-semibold text-gray-900 dark:text-slate-100">
          {formatTemp(hoveredTemp, units)}
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={className}>
        <div className="relative h-24 flex items-center justify-center">
          <span className="text-slate-400 text-sm">No data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 45,
              bottom: 30,
              left: 45,
            }}
          >
            <defs>
              <linearGradient
                id="temperature-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxisLabel}
              tick={{ fontSize: 12, fill: axisTextColor }}
              tickCount={6}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="temperature"
              type="number"
              domain={yDomain}
              tickFormatter={formatYAxisLabel}
              tick={{ fontSize: 12, fill: axisTextColor }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="temperature"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#temperature-gradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default HourlySparkline;
