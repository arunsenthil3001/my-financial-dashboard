'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Dot,
} from 'recharts';
import type { RateHistoryPoint } from '@/lib/rateIntelligence';
import type { RemittanceEntry } from '@/lib/types';
import { formatAmount } from '@/lib/currencies';

interface RateHistoryChartProps {
  history: RateHistoryPoint[];
  baseline: number | null;
  baselineSource: 'remittance_history' | 'rate_history' | null;
  remittances: RemittanceEntry[];
  earningCurrency: string;
  homeCurrency: string;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

export default function RateHistoryChart({
  history,
  baseline,
  baselineSource,
  remittances,
  earningCurrency,
  homeCurrency,
}: RateHistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-gray-400">
        No rate history yet — the cron job will populate this daily.
      </div>
    );
  }

  // Days with a remittance for quick lookup
  const remittanceDays = new Set(
    remittances
      .filter((r) => r.fromCurrency === earningCurrency && r.toCurrency === homeCurrency)
      .map((r) => r.transferDate.slice(0, 10)),
  );

  const today = new Date().toISOString().slice(0, 10);
  const lastIdx = history.length - 1;

  // Build chart data
  const chartData = history.map((pt, i) => ({
    label:         shortDate(pt.fetchedAt),
    day:           isoDay(pt.fetchedAt),
    rate:          pt.rate,
    isToday:       isoDay(pt.fetchedAt) === today,
    isRemittance:  remittanceDays.has(isoDay(pt.fetchedAt)),
    isLast:        i === lastIdx,
  }));

  // Custom dot: highlighted for today, filled for remittance days
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isToday) {
      return <circle cx={cx} cy={cy} r={6} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
    }
    if (payload.isRemittance) {
      return <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={1.5} />;
    }
    return <circle cx={cx} cy={cy} r={2} fill="#6366f1" opacity={0.4} />;
  };

  const baselineLabel =
    baselineSource === 'remittance_history' ? 'Your avg (transfers)' : '90-day avg';

  // Tick decimation: show up to 6 x-axis labels
  const tickEvery = Math.max(1, Math.floor(chartData.length / 6));
  const ticks = chartData
    .filter((_, i) => i % tickEvery === 0 || i === lastIdx)
    .map((d) => d.label);

  const yMin = Math.min(...history.map((p) => p.rate), baseline ?? Infinity);
  const yMax = Math.max(...history.map((p) => p.rate), baseline ?? -Infinity);
  const yPad = (yMax - yMin) * 0.1 || 1;

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-indigo-500 inline-block" /> Rate
        </span>
        {baseline !== null && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500 inline-block" />
            {baselineLabel}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Today
        </span>
        {remittanceDays.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Transfer day
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            domain={[yMin - yPad, yMax + yPad]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={(v: number) =>
              formatAmount(v, homeCurrency).replace(/[^\d.,]/g, (m) => m === ',' || m === '.' ? m : '')
            }
          />

          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value) => [
              `1 ${earningCurrency} = ${formatAmount(Number(value), homeCurrency)}`,
              'Rate',
            ]}
            labelFormatter={(label) => label}
          />

          {baseline !== null && (
            <ReferenceLine
              y={baseline}
              stroke="#10b981"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: baselineLabel,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#10b981',
                fontWeight: 600,
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="rate"
            stroke="#6366f1"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 5, fill: '#6366f1' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
