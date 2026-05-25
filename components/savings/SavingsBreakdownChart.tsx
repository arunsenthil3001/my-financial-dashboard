'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { SavingsEntry, SavingsType } from '@/lib/types';
import { SAVINGS_TYPE_COLORS } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  savings: SavingsEntry[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-gray-600">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function SavingsBreakdownChart({ savings }: Props) {
  const data = useMemo(() => {
    const grouped: Partial<Record<SavingsType, number>> = {};
    for (const s of savings) {
      grouped[s.type] = (grouped[s.type] ?? 0) + s.currentValue;
    }
    return Object.entries(grouped)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [savings]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Breakdown</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={SAVINGS_TYPE_COLORS[entry.name as SavingsType] ?? '#6B7280'}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
