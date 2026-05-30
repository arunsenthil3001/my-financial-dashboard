'use client';

import { useState, useEffect } from 'react';
import type { SavingsEntry, ChitCycle, ChitCycleInput } from '@/lib/types';
import { useSavings } from '@/hooks/useSavings';
import { useChitCycles } from '@/hooks/useChitCycles';
import { useRemittances } from '@/hooks/useRemittances';
import { useCurrency } from '@/lib/currencyContext';
import Modal from '@/components/ui/Modal';

import SavingsForm from './SavingsForm';
import SavingsList from './SavingsList';
import SavingsBreakdownChart from './SavingsBreakdownChart';

type TabKey = 'All' | 'FD' | 'Mutual Funds' | 'Stocks' | 'Chit Funds';
const TYPED_TABS: TabKey[] = ['FD', 'Mutual Funds', 'Stocks', 'Chit Funds'];

export default function SavingsClient() {
  const { savings, loading, add, update, remove, totalInvested, totalCurrent, totalGain, gainPct } =
    useSavings();
  const { addCycles, replaceCycles, fetchCycles } = useChitCycles();
  const { remittances } = useRemittances();
  const { toDisplay } = useCurrency();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<SavingsEntry | null>(null);
  const [editingCycles, setEditingCycles] = useState<ChitCycle[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab]   = useState<TabKey>('All');

  const openAdd = () => { setEditing(null); setEditingCycles([]); setModalOpen(true); };

  const openEdit = async (s: SavingsEntry) => {
    setEditing(s);
    if (s.type === 'Chit Funds') {
      const cycles = await fetchCycles(s.id);
      setEditingCycles(cycles);
    } else {
      setEditingCycles([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    console.log('[SavingsClient DEBUG] closeModal called\n' + new Error().stack);
    setModalOpen(false); setEditing(null); setEditingCycles([]);
  };

  const tabCounts: Record<TabKey, number> = {
    All:            savings.length,
    FD:             savings.filter(s => s.type === 'FD').length,
    'Mutual Funds': savings.filter(s => s.type === 'Mutual Funds').length,
    Stocks:         savings.filter(s => s.type === 'Stocks').length,
    'Chit Funds':   savings.filter(s => s.type === 'Chit Funds').length,
  };
  const visibleTabs: TabKey[] = ['All', ...TYPED_TABS.filter(t => tabCounts[t] > 0)];

  useEffect(() => {
    if (tabCounts[activeTab] === 0 && activeTab !== 'All') setActiveTab('All');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabCounts[activeTab], activeTab]);

  const filteredSavings = (() => {
    const base = activeTab === 'All' ? savings : savings.filter(s => s.type === activeTab);
    const gainPct = (s: SavingsEntry) =>
      s.amountInvested > 0 ? (s.currentValue - s.amountInvested) / s.amountInvested : 0;
    if (activeTab === 'FD')           return [...base].sort((a, b) => b.amountInvested - a.amountInvested);
    if (activeTab === 'Mutual Funds') return [...base].sort((a, b) => gainPct(b) - gainPct(a));
    if (activeTab === 'Stocks')       return [...base].sort((a, b) => gainPct(b) - gainPct(a));
    if (activeTab === 'Chit Funds')   return [...base].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return base;
  })();

  // ── Standard submit (FD, MF, Generic) ──
  const handleSubmit = async (data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('[SavingsClient DEBUG] handleSubmit (non-chit) called', data.type);
    setSubmitting(true);
    if (editing) {
      const ok = await update(editing.id, data);
      if (ok) closeModal();
    } else {
      const entry = await add(data);
      if (entry) closeModal();
    }
    setSubmitting(false);
  };

  // ── Chit submit (saves savings row + cycle history) ──
  const handleChitSubmit = async (
    data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>,
    cycles: ChitCycleInput[],
  ) => {
    console.log('[SavingsClient DEBUG] handleChitSubmit called, cycles:', cycles.length);
    setSubmitting(true);
    if (editing) {
      const ok = await update(editing.id, data);
      if (ok) {
        await replaceCycles(editing.id, cycles);
        closeModal();
      }
    } else {
      const entry = await add(data);
      if (entry) {
        await addCycles(entry.id, cycles);
        closeModal();
      }
    }
    setSubmitting(false);
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
          <p className="text-base font-bold text-gray-900 truncate">{toDisplay(totalInvested)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-base font-bold text-gray-900 truncate">{toDisplay(totalCurrent)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${isPositive ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs mb-1 ${isPositive ? 'text-emerald-600' : 'text-red-400'}`}>
            {isPositive ? 'Total Gain' : 'Total Loss'}
          </p>
          <p className={`text-base font-bold truncate ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{toDisplay(totalGain)}
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
        <h2 className="text-sm font-semibold text-gray-700">Savings</h2>
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

      {/* ── Tabs ── */}
      {visibleTabs.length > 1 && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max sm:min-w-0 pb-0.5">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
                <span className={`min-w-[1.1rem] text-center px-1 rounded-full text-xs font-bold ${
                  activeTab === tab ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Savings list ── */}
      <SavingsList savings={filteredSavings} onEdit={openEdit} onDelete={remove} />

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Savings' : 'Add Savings'}
      >
        <SavingsForm
          initial={editing}
          initialCycles={editingCycles}
          remittances={remittances}
          onSubmit={handleSubmit}
          onChitSubmit={handleChitSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
