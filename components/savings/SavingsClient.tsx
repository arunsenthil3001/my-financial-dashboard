'use client';

import { useState } from 'react';
import type { SavingsEntry } from '@/lib/types';
import { useSavings } from '@/hooks/useSavings';
import { formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import SavingsForm from './SavingsForm';
import SavingsList from './SavingsList';
import SavingsBreakdownChart from './SavingsBreakdownChart';

export default function SavingsClient() {
  const { savings, loading, add, update, remove, totalInvested, totalCurrent, totalGain, gainPct } =
    useSavings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: SavingsEntry) => { setEditing(s); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSubmitting(true);
    const ok = editing ? await update(editing.id, data) : await add(data);
    setSubmitting(false);
    if (ok) closeModal();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const isPositive = totalGain >= 0;

  return (
    <div className="space-y-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Invested</p>
          <p className="text-base font-bold text-gray-900 truncate">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-base font-bold text-gray-900 truncate">{formatCurrency(totalCurrent)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${isPositive ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs mb-1 ${isPositive ? 'text-emerald-600' : 'text-red-400'}`}>
            {isPositive ? 'Total Gain' : 'Total Loss'}
          </p>
          <p className={`text-base font-bold truncate ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatCurrency(totalGain)}
          </p>
          <p className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{gainPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* ── Breakdown chart ── */}
      {savings.length > 0 && <SavingsBreakdownChart savings={savings} />}

      {/* ── List header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          All Savings <span className="text-gray-400 font-normal">({savings.length})</span>
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* ── Savings list ── */}
      <SavingsList savings={savings} onEdit={openEdit} onDelete={remove} />

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Savings' : 'Add Savings'}
      >
        <SavingsForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
