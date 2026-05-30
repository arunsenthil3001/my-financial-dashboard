'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavingsEntry, SavingsType, ChitCycle, ChitCycleInput, RemittanceEntry } from '@/lib/types';
import { SAVINGS_TYPES } from '@/lib/types';
import { formatDate, todayISO, addMonths, daysUntil } from '@/lib/utils';
import { formatAmount, CURRENCIES } from '@/lib/currencies';
import { useCurrency } from '@/lib/currencyContext';
import {
  calcFDValue, fdMaturityDate,
  type CompoundFrequency,
} from '@/lib/notesParsers';

// ─── Shared input / label styles ─────────────────────────────────────────────

const inp =
  'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ' +
  'focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const err = 'text-xs text-red-500 mt-1';

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className={lbl}>{children}</label>;
}
function Err({ msg }: { msg?: string }) {
  return msg ? <p className={err}>{msg}</p> : null;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

// ─── Chit step indicator ──────────────────────────────────────────────────────

function StepBar({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} className="flex items-center gap-1.5 flex-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${done ? 'bg-indigo-600 text-white'
                : active ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                : 'bg-gray-100 text-gray-400'}`}
            >
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block truncate
              ${active ? 'text-indigo-700' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < labels.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chit past-cycle row state ────────────────────────────────────────────────

interface PastCycleState {
  cycleNumber: number;
  scheduledDate: string;        // computed, not editable
  confirmed: boolean;           // user explicitly said "Yes this happened" (cycle 1 = always true)
  amountPaid: string;
  cycleDate: string;            // actual date entered by user (defaults to scheduledDate)
  userWon: boolean;
  bidAmountReceived: string;
  impliedBidAmount: number | null;
  commissionDistributed: number | null;
  isLocked: boolean;            // true for cycle 1 and all post-win cycles
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initial?: SavingsEntry | null;
  initialCycles?: ChitCycle[];
  remittances?: RemittanceEntry[];
  onSubmit: (data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onChitSubmit?: (
    data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>,
    cycles: ChitCycleInput[],
  ) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDatePast(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d <= today;
}

function isWithinCascadeWindow(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + 30);
  return d <= cutoff;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SavingsForm({
  initial, initialCycles, remittances = [], onSubmit, onChitSubmit, onCancel, submitting = false,
}: Props) {
  const { homeCurrency } = useCurrency();

  // ── Common ──
  const [name, setName]                 = useState('');
  const [type, setType]                 = useState<SavingsType>('FD');
  const [startDate, setStartDate]       = useState(todayISO());
  const [remittanceId, setRemittanceId] = useState<string>(initial?.remittanceId ?? '');
  const [errors, setErrors]             = useState<Record<string, string>>({});

  // ── Generic (Stocks, PPF, Gold, Other) ──
  const [gInvested, setGInvested] = useState('');
  const [gCurrent, setGCurrent]   = useState('');
  const [gNotes, setGNotes]       = useState('');

  // ── FD ──
  const [fdPrincipal, setFdPrincipal] = useState('');
  const [fdRate, setFdRate]           = useState('');
  const [fdTenure, setFdTenure]       = useState('');
  const [fdFreq, setFdFreq]           = useState<CompoundFrequency>('quarterly');

  // ── Chit Fund ──
  const [chitStep, setChitStep]             = useState<1 | 2 | 3>(1);
  const [chitMembers, setChitMembers]       = useState('');
  const [chitFaceValue, setChitFaceValue]   = useState('');
  const [chitDuration, setChitDuration]     = useState('');
  const [chitIsForeman, setChitIsForeman]   = useState(false);
  const [chitPastCycles, setChitPastCycles] = useState<PastCycleState[]>([]);

  // ── MF ──
  const [mfFolio, setMfFolio]           = useState('');
  const [mfScheme, setMfScheme]         = useState('');
  const [mfUnits, setMfUnits]           = useState('');
  const [mfNavBuy, setMfNavBuy]         = useState('');
  const [mfCode, setMfCode]             = useState('');
  const [mfCurrentNav, setMfCurrentNav] = useState('');
  const [mfNavDate, setMfNavDate]       = useState('');
  const [mfFetching, setMfFetching]     = useState(false);
  const [mfFetchErr, setMfFetchErr]     = useState('');

  // ── Populate from `initial` (edit mode) ──────────────────────────────────

  useEffect(() => {
    setErrors({});
    setChitStep(1);
    if (!initial) {
      setName(''); setType('FD'); setStartDate(todayISO());
      setRemittanceId('');
      setGInvested(''); setGCurrent(''); setGNotes('');
      setFdPrincipal(''); setFdRate(''); setFdTenure(''); setFdFreq('quarterly');
      setChitMembers(''); setChitFaceValue(''); setChitDuration('');
      setChitIsForeman(false); setChitPastCycles([]);
      setMfFolio(''); setMfScheme(''); setMfUnits(''); setMfNavBuy('');
      setMfCode(''); setMfCurrentNav(''); setMfNavDate(''); setMfFetchErr('');
      return;
    }
    setName(initial.name);
    setType(initial.type);
    setStartDate(initial.startDate);
    setRemittanceId(initial.remittanceId ?? '');

    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(initial.notes); } catch { /* plain text */ }

    if (initial.type === 'FD') {
      setFdPrincipal(String(initial.amountInvested));
      setFdRate(String(meta.interest_rate ?? ''));
      setFdTenure(String(meta.tenure_months ?? ''));
      setFdFreq((meta.compound_frequency as CompoundFrequency) ?? 'quarterly');
    } else if (initial.type === 'Chit Funds') {
      setChitMembers(String(initial.chitMembers ?? ''));
      setChitFaceValue(String(initial.chitFaceValue ?? ''));
      setChitDuration(String(initial.chitDurationMonths ?? ''));
      setChitIsForeman(initial.chitIsForeman ?? false);
      if (initialCycles?.length) {
        const bf  = initial.chitBidFrequency ?? 0;
        const fv  = initial.chitFaceValue ?? 0;
        const n   = initial.chitMembers ?? 0;
        const isF = initial.chitIsForeman ?? false;
        // Pre-populate all DB cycles as confirmed
        setChitPastCycles(
          initialCycles.map((c, idx) => {
            const scheduled = bf > 0 ? addMonths(initial.startDate, (c.cycleNumber - 1) * bf) : initial.startDate;
            const isFirst   = c.cycleNumber === 1;
            const wonCycle  = initialCycles.find(x => x.userWon);
            const isPostWin = !isFirst && !!wonCycle && c.cycleNumber > wonCycle.cycleNumber;
            return {
              cycleNumber:           c.cycleNumber,
              scheduledDate:         scheduled,
              confirmed:             true,
              amountPaid:            String(c.amountPaid),
              cycleDate:             c.cycleDate ?? scheduled,
              userWon:               c.userWon,
              bidAmountReceived:     c.bidAmountReceived !== null ? String(c.bidAmountReceived) : '',
              impliedBidAmount:      null,
              commissionDistributed: null,
              isLocked:              isFirst || isPostWin,
            };
          }),
        );
      }
    } else if (initial.type === 'Mutual Funds') {
      setMfFolio(String(meta.folio ?? ''));
      setMfScheme(String(meta.scheme_name ?? ''));
      setMfUnits(String(meta.units ?? ''));
      setMfNavBuy(String(meta.nav_at_purchase ?? ''));
      setMfCode(meta.scheme_code != null ? String(meta.scheme_code) : '');
      setMfCurrentNav(String(meta.current_nav ?? ''));
      setMfNavDate(String(meta.nav_updated_date ?? ''));
    } else {
      setGInvested(String(initial.amountInvested));
      setGCurrent(String(initial.currentValue));
      setGNotes(initial.notes);
    }
  }, [initial, initialCycles]);

  // ── FD derived values ─────────────────────────────────────────────────────

  const fdCurrentValue = useMemo(() => {
    const p = Number(fdPrincipal), r = Number(fdRate), t = Number(fdTenure);
    if (!p || !r || !t) return 0;
    return calcFDValue(p, { interest_rate: r, tenure_months: t, compound_frequency: fdFreq });
  }, [fdPrincipal, fdRate, fdTenure, fdFreq]);

  const fdMaturity = useMemo(
    () => fdMaturityDate(startDate, Number(fdTenure)),
    [startDate, fdTenure],
  );
  const fdGainPct = Number(fdPrincipal) > 0
    ? ((fdCurrentValue - Number(fdPrincipal)) / Number(fdPrincipal)) * 100 : 0;

  // ── Chit derived values ───────────────────────────────────────────────────

  const chitBidFreqVal = useMemo(() => {
    const n = Number(chitMembers), d = Number(chitDuration);
    return n > 0 && d > 0 ? Math.round(d / n) : 0;
  }, [chitMembers, chitDuration]);

  const chitTotalPool = useMemo(
    () => Number(chitMembers) * Number(chitFaceValue),
    [chitMembers, chitFaceValue],
  );

  // ── Cascade helpers ───────────────────────────────────────────────────────

  // Build next unconfirmed cycle or next post-win locked cycle to append
  function buildNextCycle(
    fromCycleDate: string,
    fromCycleNumber: number,
    bf: number,
    fv: number,
    isPostWin: boolean,
  ): PastCycleState | null {
    if (!fromCycleDate || bf <= 0) return null;
    const nextNum    = fromCycleNumber + 1;
    const nextSched  = addMonths(fromCycleDate, bf);
    if (!isWithinCascadeWindow(nextSched)) return null;
    return {
      cycleNumber:           nextNum,
      scheduledDate:         nextSched,
      confirmed:             isPostWin,
      amountPaid:            isPostWin ? String(fv) : '',
      cycleDate:             nextSched,
      userWon:               false,
      bidAmountReceived:     '',
      impliedBidAmount:      null,
      commissionDistributed: null,
      isLocked:              isPostWin,
    };
  }

  // ── Initialise cycle list when entering step 2 (Step 1 fields change) ────
  // Only runs when type, bid frequency, face value, or startDate changes.
  // Preserves confirmed cycle data from previous state.
  useEffect(() => {
    if (type !== 'Chit Funds') return;
    const fv = Number(chitFaceValue);
    const n  = Number(chitMembers);
    const bf = chitBidFreqVal;
    if (!bf || !fv || !n) { setChitPastCycles([]); return; }

    setChitPastCycles((prev) => {
      // Cycle 1 must have occurred (startDate <= today)
      if (!isDatePast(startDate)) return [];

      // Rebuild cycle 1
      const prevC1: PastCycleState = {
        cycleNumber:           1,
        scheduledDate:         startDate,
        confirmed:             true,
        amountPaid:            String(fv),
        cycleDate:             prev.find((c) => c.cycleNumber === 1)?.cycleDate ?? startDate,
        userWon:               chitIsForeman,
        bidAmountReceived:     chitIsForeman ? String(n * fv) : '',
        impliedBidAmount:      null,
        commissionDistributed: null,
        isLocked:              true,
      };

      // Restore any confirmed cycles from previous state (for edit mode or after Back)
      const restoredCycles: PastCycleState[] = [prevC1];
      for (let i = 2; i <= prev.length; i++) {
        const p = prev.find((c) => c.cycleNumber === i);
        if (p && p.confirmed) {
          // Recalculate scheduled date from previous actual
          const prevActual = restoredCycles[restoredCycles.length - 1]?.cycleDate ?? startDate;
          restoredCycles.push({
            ...p,
            scheduledDate: addMonths(prevActual, bf),
            isLocked:      i === 1 || (restoredCycles.some((c) => c.userWon) &&
              i > (restoredCycles.find((c) => c.userWon)?.cycleNumber ?? Infinity)),
          });
        } else {
          break; // stop at first unconfirmed
        }
      }

      // Cascade forward from the last confirmed cycle
      const last         = restoredCycles[restoredCycles.length - 1];
      const wonCycleNum  = restoredCycles.find((c) => c.userWon)?.cycleNumber ?? null;
      const nextIsPostWin = wonCycleNum !== null && (last.cycleNumber + 1) > wonCycleNum;

      if (last.confirmed) {
        const next = buildNextCycle(last.cycleDate, last.cycleNumber, bf, fv, nextIsPostWin);
        if (next) {
          if (nextIsPostWin) {
            // Auto-cascade all remaining elapsed post-win cycles
            const cascaded = [...restoredCycles, next];
            let cur = next;
            while (cur.isLocked && cur.confirmed) {
              const wonNext = buildNextCycle(cur.cycleDate, cur.cycleNumber, bf, fv, true);
              if (!wonNext) break;
              cascaded.push(wonNext);
              cur = wonNext;
            }
            return cascaded;
          }
          return [...restoredCycles, next];
        }
      }
      return restoredCycles;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, chitBidFreqVal, chitFaceValue, chitMembers, chitIsForeman, startDate]);

  // ── Confirm a cycle (user clicks "Yes") ──────────────────────────────────

  function confirmCycle(idx: number) {
    const fv = Number(chitFaceValue);
    const n  = Number(chitMembers);
    const bf = chitBidFreqVal;
    setChitPastCycles((prev) => {
      const next      = [...prev];
      next[idx]       = { ...next[idx], confirmed: true };
      const confirmed = next[idx];

      const wonCycleNum  = next.find((c) => c.userWon)?.cycleNumber ?? null;
      const nextIsPostWin = wonCycleNum !== null && (confirmed.cycleNumber + 1) > wonCycleNum;

      // Cascade: append next cycle if applicable and not already present
      if (!next.some((c) => c.cycleNumber === confirmed.cycleNumber + 1)) {
        const nextCycle = buildNextCycle(confirmed.cycleDate, confirmed.cycleNumber, bf, fv, nextIsPostWin);
        if (nextCycle) {
          if (nextIsPostWin) {
            next.push(nextCycle);
            let cur = nextCycle;
            while (cur.isLocked && cur.confirmed) {
              const further = buildNextCycle(cur.cycleDate, cur.cycleNumber, bf, fv, true);
              if (!further) break;
              next.push(further);
              cur = further;
            }
          } else {
            next.push(nextCycle);
          }
        }
      }
      return next;
    });
  }

  // ── Deny a cycle (user clicks "No" / keeps default No) ───────────────────

  function denyCycle(idx: number) {
    setChitPastCycles((prev) => {
      // Remove all cycles from idx onward, keeping only up to (but not including) this one
      return prev.slice(0, idx + 1).map((c, i) =>
        i === idx ? { ...c, confirmed: false } : c,
      );
    });
  }

  // ── Back-calculate commission for a confirmed cycle row on blur ───────────

  function recalcCycleRow(idx: number) {
    setChitPastCycles((prev) => {
      const next = [...prev];
      const c    = next[idx];
      if (!c || c.isLocked) return prev;
      const fv  = Number(chitFaceValue);
      const n   = Number(chitMembers);
      const pool = n * fv;
      const amtPaid = Number(c.amountPaid);
      if (!amtPaid || isNaN(amtPaid)) return prev;
      const eligibleCount    = Math.max(0, n - c.cycleNumber);
      const commPerMember    = Math.max(0, fv - amtPaid);
      const totalComm        = commPerMember * eligibleCount;
      const impliedBidAmount = pool - totalComm;
      next[idx] = { ...c, impliedBidAmount, commissionDistributed: totalComm };
      return next;
    });
  }

  // ── When a cycle's userWon changes: propagate post-win lock state ─────────

  function toggleUserWon(idx: number, checked: boolean) {
    const fv = Number(chitFaceValue);
    const bf = chitBidFreqVal;
    setChitPastCycles((prev) => {
      const next = [...prev];
      next[idx]  = { ...next[idx], userWon: checked, bidAmountReceived: '' };

      if (!checked) {
        // Clear post-win lock on subsequent cycles when un-winning
        for (let i = idx + 1; i < next.length; i++) {
          next[i] = { ...next[i], isLocked: false, amountPaid: '', confirmed: false };
        }
        // Remove cycles beyond this one since they may no longer be valid
        return next.slice(0, idx + 1);
      }

      // Mark all subsequent already-in-array cycles as post-win locked
      for (let i = idx + 1; i < next.length; i++) {
        next[i] = { ...next[i], isLocked: true, amountPaid: String(fv), confirmed: true };
      }

      // Cascade remaining elapsed cycles as post-win
      let cur = next[next.length - 1];
      while (true) {
        const further = buildNextCycle(cur.cycleDate, cur.cycleNumber, bf, fv, true);
        if (!further) break;
        next.push(further);
        cur = further;
      }
      return next;
    });
  }

  // ── Summary (uses only confirmed cycles) ──────────────────────────────────

  const confirmedCycles = useMemo(
    () => chitPastCycles.filter((c) => c.confirmed || c.cycleNumber === 1),
    [chitPastCycles],
  );

  const chitSummary = useMemo(() => {
    const fv   = Number(chitFaceValue);
    const n    = Number(chitMembers);
    const d    = Number(chitDuration);
    const bf   = chitBidFreqVal;
    const totalCycles     = bf > 0 ? Math.round(d / bf) : 0;
    const cyclesCompleted = confirmedCycles.length;
    const remainingCycles = Math.max(0, totalCycles - cyclesCompleted);

    const totalPaid    = confirmedCycles.reduce((s, c) => s + (Number(c.amountPaid) || 0), 0);
    const wonCycle     = confirmedCycles.find((c) => c.userWon);
    const hasWon       = chitIsForeman || !!wonCycle;
    const bidReceived  = chitIsForeman
      ? n * fv
      : (wonCycle?.bidAmountReceived ? Number(wonCycle.bidAmountReceived) : 0);

    const futurePayments  = remainingCycles * fv;
    const totalCommitted  = totalPaid + futurePayments;
    const netGain         = bidReceived > 0 ? bidReceived - totalCommitted : null;
    const gainPct         = netGain !== null && totalCommitted > 0
      ? (netGain / totalCommitted) * 100 : null;

    // Projected bid for not-won: most recent implied bid from confirmed cycles, fallback 0.85
    const lastImplied = [...confirmedCycles]
      .reverse()
      .find((c) => c.impliedBidAmount !== null)?.impliedBidAmount ?? null;
    const projectedBid = !hasWon
      ? (lastImplied !== null ? lastImplied : (n * fv * 0.85))
      : null;
    const projectedGain = projectedBid !== null ? projectedBid - totalCommitted : null;

    // Next bid date: unconfirmed pending cycle (within 30-day window) takes precedence
    const lastConfirmed = confirmedCycles[confirmedCycles.length - 1];
    const lastBidDate   = lastConfirmed?.cycleDate ?? null;
    const pendingCycle  = chitPastCycles
      .filter(c => c.cycleNumber > 1 && !c.confirmed)
      .sort((a, b) => a.cycleNumber - b.cycleNumber)[0] ?? null;
    const nextBidDate   = pendingCycle
      ? pendingCycle.scheduledDate
      : bf > 0 && lastBidDate ? addMonths(lastBidDate, bf) : '';
    const daysLeft      = nextBidDate ? daysUntil(nextBidDate) : null;

    return {
      totalPaid, futurePayments, totalCommitted,
      bidReceived, netGain, gainPct, hasWon,
      projectedBid, projectedGain,
      remainingCycles, totalCycles, cyclesCompleted,
      nextBidDate, daysLeft, lastBidDate,
    };
  }, [confirmedCycles, chitFaceValue, chitMembers, chitDuration, chitBidFreqVal, chitIsForeman, chitPastCycles]);

  // ── MF derived values ─────────────────────────────────────────────────────

  const mfInvested     = useMemo(() => Number(mfUnits) * Number(mfNavBuy), [mfUnits, mfNavBuy]);
  const mfCurrentValue = useMemo(() => Number(mfUnits) * Number(mfCurrentNav), [mfUnits, mfCurrentNav]);
  const mfGainPct      = mfInvested > 0 ? ((mfCurrentValue - mfInvested) / mfInvested) * 100 : 0;

  const fetchNav = useCallback(async () => {
    if (!mfCode.trim()) return;
    setMfFetching(true); setMfFetchErr('');
    try {
      const res  = await fetch(`https://api.mfapi.in/mf/${mfCode.trim()}`);
      const json = await res.json();
      if (json.status !== 'SUCCESS' || !json.data?.length) {
        setMfFetchErr('Invalid scheme code or no data');
      } else {
        setMfCurrentNav(json.data[0].nav);
        setMfNavDate(json.data[0].date);
        if (!mfScheme && json.meta?.scheme_name) setMfScheme(json.meta.scheme_name);
      }
    } catch { setMfFetchErr('Network error — check your connection'); }
    finally  { setMfFetching(false); }
  }, [mfCode, mfScheme]);

  // ── Validation ────────────────────────────────────────────────────────────

  const setErr = (k: string, v: string) => setErrors((p) => ({ ...p, [k]: v }));
  const clrErr = (k: string) => setErrors((p) => { const n = { ...p }; delete n[k]; return n; });

  function validateCommon() {
    let ok = true;
    if (!name.trim()) { setErr('name', 'Name is required'); ok = false; }
    if (!startDate)   { setErr('startDate', 'Date is required'); ok = false; }
    return ok;
  }

  function validateFD() {
    let ok = validateCommon();
    if (!fdPrincipal || Number(fdPrincipal) <= 0) { setErr('fdPrincipal', 'Enter amount'); ok = false; }
    if (!fdRate || Number(fdRate) <= 0)           { setErr('fdRate', 'Enter interest rate'); ok = false; }
    if (!fdTenure || Number(fdTenure) <= 0)       { setErr('fdTenure', 'Enter tenure'); ok = false; }
    return ok;
  }

  function validateChitStep1() {
    let ok = validateCommon();
    if (!chitMembers || Number(chitMembers) < 2)     { setErr('chitMembers', 'Min 2 members'); ok = false; }
    if (!chitFaceValue || Number(chitFaceValue) <= 0) { setErr('chitFaceValue', 'Enter face value'); ok = false; }
    if (!chitDuration || Number(chitDuration) <= 0)  { setErr('chitDuration', 'Enter duration'); ok = false; }
    return ok;
  }

  function validateChitStep2() {
    const fv = Number(chitFaceValue);
    let ok = true;
    confirmedCycles.forEach((c) => {
      if (c.isLocked) return; // cycle 1 and post-win cycles always valid
      const amt = Number(c.amountPaid);
      if (!c.amountPaid || isNaN(amt) || amt <= 0) {
        setErr(`cycle_${c.cycleNumber}_paid`, 'Enter amount paid'); ok = false;
      } else if (amt > fv) {
        setErr(`cycle_${c.cycleNumber}_paid`, `Must be ≤ ${formatAmount(fv, homeCurrency)}`); ok = false;
      }
      if (c.userWon && !c.bidAmountReceived) {
        setErr(`cycle_${c.cycleNumber}_bid`, 'Enter amount received'); ok = false;
      }
    });
    return ok;
  }

  function validateMF() {
    let ok = validateCommon();
    if (!mfScheme.trim()) { setErr('mfScheme', 'Scheme name required'); ok = false; }
    if (!mfUnits || Number(mfUnits) <= 0)         { setErr('mfUnits', 'Enter units'); ok = false; }
    if (!mfNavBuy || Number(mfNavBuy) <= 0)       { setErr('mfNavBuy', 'Enter NAV at purchase'); ok = false; }
    if (!mfCurrentNav || Number(mfCurrentNav) <= 0) { setErr('mfCurrentNav', 'Enter current NAV'); ok = false; }
    return ok;
  }

  function validateGeneric() {
    let ok = validateCommon();
    if (!gInvested || Number(gInvested) < 0) { setErr('gInvested', 'Enter amount'); ok = false; }
    if (!gCurrent  || Number(gCurrent)  < 0) { setErr('gCurrent',  'Enter current value'); ok = false; }
    return ok;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrors({});

    // Chit steps 1/2: Enter key in a field should advance the wizard, never submit
    if (type === 'Chit Funds' && chitStep < 3) {
      chitNext();
      return;
    }

    if (type === 'FD') {
      if (!validateFD()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Number(fdPrincipal),
        currentValue: Math.round(fdCurrentValue * 100) / 100,
        notes: JSON.stringify({ interest_rate: Number(fdRate), tenure_months: Number(fdTenure), compound_frequency: fdFreq }),
        chitMembers: null, chitFaceValue: null, chitDurationMonths: null,
        chitBidFrequency: null, chitWonCycle: null, chitBidReceived: null, chitIsForeman: null,
        remittanceId: remittanceId || null,
      });

    } else if (type === 'Chit Funds') {
      if (!validateChitStep1()) return;
      if (confirmedCycles.length > 1 && !validateChitStep2()) return;

      const fv  = Number(chitFaceValue);
      const n   = Number(chitMembers);
      const bf  = chitBidFreqVal;

      // Only submit confirmed cycles
      const cycles: ChitCycleInput[] = confirmedCycles.map((c) => {
        const isFirst    = c.cycleNumber === 1;
        const amtPaid    = Number(c.amountPaid) || 0;
        const eligible   = Math.max(0, n - c.cycleNumber);
        const commPerMem = isFirst ? 0 : Math.max(0, fv - amtPaid);
        const totalComm  = commPerMem * eligible;
        return {
          cycleNumber:      c.cycleNumber,
          amountPaid:       amtPaid,
          commissionReceived: commPerMem,
          totalCommission:    totalComm,
          userWon:            c.userWon,
          bidAmountReceived:  c.userWon ? (Number(c.bidAmountReceived) || null) : null,
          cycleDate:          c.cycleDate || null,
        };
      });

      const totalPaid   = cycles.reduce((s, c) => s + c.amountPaid, 0);
      const wonCycle    = cycles.find((c) => c.userWon);
      const bidReceived = chitIsForeman ? (n * fv) : (wonCycle?.bidAmountReceived ?? 0);
      const hasWon      = chitIsForeman || !!wonCycle;
      const currentValue = hasWon ? bidReceived : totalPaid;

      const savingsData: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(), type, startDate,
        amountInvested: totalPaid,
        currentValue,
        notes: '',
        chitMembers: n,
        chitFaceValue: fv,
        chitDurationMonths: Number(chitDuration),
        chitBidFrequency: bf,
        chitWonCycle: wonCycle?.cycleNumber ?? (chitIsForeman ? 1 : null),
        chitBidReceived: bidReceived > 0 ? bidReceived : null,
        chitIsForeman,
        remittanceId: remittanceId || null,
      };

      if (onChitSubmit) {
        onChitSubmit(savingsData, cycles);
      } else {
        onSubmit(savingsData);
      }

    } else if (type === 'Mutual Funds') {
      if (!validateMF()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Math.round(mfInvested * 100) / 100,
        currentValue: Math.round(mfCurrentValue * 100) / 100,
        notes: JSON.stringify({
          folio: mfFolio.trim(), scheme_name: mfScheme.trim(),
          units: Number(mfUnits), nav_at_purchase: Number(mfNavBuy),
          current_nav: Number(mfCurrentNav),
          scheme_code: mfCode ? Number(mfCode) : null,
          nav_updated_date: mfNavDate,
        }),
        chitMembers: null, chitFaceValue: null, chitDurationMonths: null,
        chitBidFrequency: null, chitWonCycle: null, chitBidReceived: null, chitIsForeman: null,
        remittanceId: remittanceId || null,
      });

    } else {
      if (!validateGeneric()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Number(gInvested),
        currentValue: Number(gCurrent),
        notes: gNotes.trim(),
        chitMembers: null, chitFaceValue: null, chitDurationMonths: null,
        chitBidFrequency: null, chitWonCycle: null, chitBidReceived: null, chitIsForeman: null,
        remittanceId: remittanceId || null,
      });
    }
  };

  // ── Chit step nav ─────────────────────────────────────────────────────────

  // Has at least one non-cycle-1 confirmed cycle or a pending unconfirmed cycle to enter?
  const hasHistoryToEnter = chitPastCycles.length > 0;

  const chitNext = () => {
    setErrors({});
    if (chitStep === 1) {
      if (!validateChitStep1()) return;
      setChitStep(hasHistoryToEnter ? 2 : 3);
    } else if (chitStep === 2) {
      if (!validateChitStep2()) return;
      setChitStep(3);
    }
  };
  const chitBack = () => {
    if (chitStep === 3) setChitStep(hasHistoryToEnter ? 2 : 1);
    else setChitStep((s) => Math.max(1, s - 1) as 1 | 2 | 3);
  };

  const isChit = type === 'Chit Funds';
  const stepLabels = hasHistoryToEnter
    ? ['Fund Basics', 'Past Cycles', 'Summary']
    : ['Fund Basics', 'Summary'];
  const stepBarIndex = hasHistoryToEnter ? chitStep : (chitStep === 3 ? 2 : 1);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Common: Name + Type ── (hidden in chit steps 2 & 3 to save space) */}
      {(!isChit || chitStep === 1) && (
        <>
          <div>
            <Lbl>Name *</Lbl>
            <input type="text" value={name} placeholder="e.g. SBI FD, Lakshmi Chit"
              onChange={(e) => { setName(e.target.value); clrErr('name'); }}
              className={inp} />
            <Err msg={errors.name} />
          </div>

          <div>
            <Lbl>Type *</Lbl>
            <select value={type} onChange={(e) => setType(e.target.value as SavingsType)}
              className={inp + ' bg-white'}>
              {SAVINGS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <Lbl>Start Date *</Lbl>
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); clrErr('startDate'); }}
              className={inp} />
            <Err msg={errors.startDate} />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          FD SECTION — untouched
      ════════════════════════════════════════════════════════════ */}
      {type === 'FD' && (
        <>
          <div>
            <Lbl>Amount Invested (₹) *</Lbl>
            <input type="number" min="0" step="any" value={fdPrincipal} placeholder="100000"
              onChange={(e) => { setFdPrincipal(e.target.value); clrErr('fdPrincipal'); }}
              className={inp} />
            <Err msg={errors.fdPrincipal} />
          </div>

          <Row>
            <div>
              <Lbl>Interest Rate (% p.a.) *</Lbl>
              <input type="number" min="0" step="0.01" value={fdRate} placeholder="7.5"
                onChange={(e) => { setFdRate(e.target.value); clrErr('fdRate'); }}
                className={inp} />
              <Err msg={errors.fdRate} />
            </div>
            <div>
              <Lbl>Tenure (months) *</Lbl>
              <input type="number" min="1" step="1" value={fdTenure} placeholder="24"
                onChange={(e) => { setFdTenure(e.target.value); clrErr('fdTenure'); }}
                className={inp} />
              <Err msg={errors.fdTenure} />
            </div>
          </Row>

          <div>
            <Lbl>Compounding Frequency *</Lbl>
            <select value={fdFreq} onChange={(e) => setFdFreq(e.target.value as CompoundFrequency)}
              className={inp + ' bg-white'}>
              <option value="quarterly">Quarterly (4×/year)</option>
              <option value="monthly">Monthly (12×/year)</option>
              <option value="annually">Annually (1×/year)</option>
            </select>
          </div>

          {fdCurrentValue > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-600 mb-3 uppercase tracking-wide">Live Preview</p>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-blue-400">Invested</p>
                  <p className="text-sm font-bold text-blue-900">{formatAmount(Number(fdPrincipal), homeCurrency)}</p></div>
                <div><p className="text-xs text-blue-400">Maturity Value</p>
                  <p className="text-sm font-bold text-blue-900">{formatAmount(fdCurrentValue, homeCurrency)}</p></div>
                <div><p className="text-xs text-blue-400">Gain</p>
                  <p className="text-sm font-bold text-emerald-700">
                    +{formatAmount(fdCurrentValue - Number(fdPrincipal), homeCurrency)}
                    <span className="text-xs font-normal ml-1">({fdGainPct.toFixed(2)}%)</span>
                  </p></div>
                <div><p className="text-xs text-blue-400">Maturity Date</p>
                  <p className="text-sm font-bold text-blue-900">{fdMaturity ? formatDate(fdMaturity) : '—'}</p></div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          CHIT FUND — 3-step form
      ════════════════════════════════════════════════════════════ */}
      {type === 'Chit Funds' && (
        <div className="space-y-4">
          <StepBar step={stepBarIndex} labels={stepLabels} />

          {/* ── Step 1: Fund Basics ── */}
          {chitStep === 1 && (
            <>
              <Row>
                <div>
                  <Lbl>Total Members (N) *</Lbl>
                  <input type="number" min="2" step="1" value={chitMembers} placeholder="10"
                    onChange={(e) => { setChitMembers(e.target.value); clrErr('chitMembers'); }}
                    className={inp} />
                  <Err msg={errors.chitMembers} />
                </div>
                <div>
                  <Lbl>Face Value per Cycle (₹) *</Lbl>
                  <input type="number" min="1" step="any" value={chitFaceValue} placeholder="10000"
                    onChange={(e) => { setChitFaceValue(e.target.value); clrErr('chitFaceValue'); }}
                    className={inp} />
                  <Err msg={errors.chitFaceValue} />
                </div>
              </Row>

              <div>
                <Lbl>Duration (months) *</Lbl>
                <input type="number" min="1" step="1" value={chitDuration} placeholder="60"
                  onChange={(e) => { setChitDuration(e.target.value); clrErr('chitDuration'); }}
                  className={inp} />
                <Err msg={errors.chitDuration} />
              </div>

              {chitBidFreqVal > 0 && Number(chitFaceValue) > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-amber-700">
                    <span>Bid every</span>
                    <span className="font-semibold">{chitBidFreqVal} months</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Pool per bid</span>
                    <span className="font-semibold">{formatAmount(chitTotalPool, homeCurrency)}</span>
                  </div>
                  {chitPastCycles.length > 0 && (
                    <div className="flex justify-between text-amber-800 font-medium">
                      <span>Cycles to confirm</span>
                      <span>{chitPastCycles.length}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-900">Are you the foreman?</p>
                  <p className="text-xs text-amber-600 mt-0.5">You received the full pool at Cycle 1 with no commission deducted</p>
                </div>
                <button type="button"
                  onClick={() => setChitIsForeman((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${chitIsForeman ? 'bg-amber-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${chitIsForeman ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Past Cycles ── */}
          {chitStep === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Confirm each cycle that has occurred. Only confirmed cycles are saved.
              </p>

              {chitPastCycles.map((c, idx) => {
                const fv         = Number(chitFaceValue);
                const isLast     = idx === chitPastCycles.length - 1;
                // Pending unconfirmed cycle: cycle N>1 that user hasn't answered yet
                const isPending  = c.cycleNumber > 1 && !c.confirmed;

                return (
                  <div key={c.cycleNumber}
                    className={`rounded-xl border p-3 space-y-2
                      ${c.isLocked ? 'bg-amber-50 border-amber-100'
                      : isPending   ? 'bg-gray-50 border-gray-200'
                      : 'bg-white border-gray-100'}`}>

                    {/* ── Row header ── */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">
                        Cycle {c.cycleNumber}
                        {c.isLocked && c.cycleNumber === 1 && (
                          <span className="ml-2 text-amber-600 font-normal">
                            Foreman cycle — {chitIsForeman ? 'you took this' : 'foreman took this'}
                          </span>
                        )}
                        {c.isLocked && c.cycleNumber > 1 && (
                          <span className="ml-2 text-blue-600 font-normal">Full face value (post-win)</span>
                        )}
                      </span>
                      {/* Scheduled date label */}
                      <span className="text-xs text-gray-400">
                        Scheduled: {formatDate(c.scheduledDate)}
                      </span>
                    </div>

                    {/* ── Confirmation toggle (non-locked cycles > cycle 1 only) ── */}
                    {c.cycleNumber > 1 && !c.isLocked && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Has this bid happened?</span>
                        <button
                          type="button"
                          onClick={() => confirmCycle(idx)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            c.confirmed ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => denyCycle(idx)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            !c.confirmed ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    )}

                    {/* ── Expanded fields (confirmed or cycle 1) ── */}
                    {(c.confirmed || c.cycleNumber === 1) && (
                      <>
                        {/* Amount paid */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">Amount paid (₹) *</p>
                            <input type="number" min="0" step="any"
                              value={c.amountPaid}
                              disabled={c.isLocked}
                              placeholder={String(fv || '')}
                              onChange={(e) => {
                                setChitPastCycles((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], amountPaid: e.target.value, impliedBidAmount: null, commissionDistributed: null };
                                  return next;
                                });
                                clrErr(`cycle_${c.cycleNumber}_paid`);
                              }}
                              onBlur={() => recalcCycleRow(idx)}
                              className={inp + ' text-sm'} />
                            <Err msg={errors[`cycle_${c.cycleNumber}_paid`]} />
                            {!c.isLocked && c.impliedBidAmount !== null && (
                              <p className="text-xs text-gray-400 mt-1">
                                Implied bid: <span className="font-medium text-gray-600">{formatAmount(c.impliedBidAmount, homeCurrency)}</span>
                                {' '}· Commission distributed: <span className="font-medium text-gray-600">{formatAmount(c.commissionDistributed ?? 0, homeCurrency)}</span>
                              </p>
                            )}
                          </div>

                          {/* Bid amount received (if won) */}
                          {c.userWon && !c.isLocked && (
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 mb-1">Bid amount received (₹) *</p>
                              <input type="number" min="0" step="any"
                                value={c.bidAmountReceived}
                                placeholder={String(chitTotalPool || '')}
                                onChange={(e) => {
                                  setChitPastCycles((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], bidAmountReceived: e.target.value };
                                    return next;
                                  });
                                  clrErr(`cycle_${c.cycleNumber}_bid`);
                                }}
                                className={inp + ' text-sm'} />
                              <Err msg={errors[`cycle_${c.cycleNumber}_bid`]} />
                            </div>
                          )}
                        </div>

                        {/* I won this cycle (non-locked, non-cycle-1) */}
                        {!c.isLocked && c.cycleNumber > 1 && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.userWon}
                              onChange={(e) => toggleUserWon(idx, e.target.checked)}
                              className="w-4 h-4 accent-indigo-600" />
                            <span className="text-xs font-medium text-gray-600">I won this cycle</span>
                          </label>
                        )}

                        {/* Cycle date */}
                        {isLast && !isPending ? (
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                            <p className="text-xs font-semibold text-indigo-700 mb-1.5">
                              Actual bid date — used to calculate your next bid date
                            </p>
                            <input
                              type="date"
                              value={c.cycleDate}
                              onChange={(e) => setChitPastCycles((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], cycleDate: e.target.value };
                                return next;
                              })}
                              className={inp + ' text-sm bg-white'}
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Cycle date</p>
                            <input
                              type="date"
                              value={c.cycleDate}
                              onChange={(e) => setChitPastCycles((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], cycleDate: e.target.value };
                                return next;
                              })}
                              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Pending: show "stop" message */}
                    {isPending && !c.confirmed && (
                      <p className="text-xs text-gray-400 italic">
                        Click Yes to record this cycle, or No to set this as the next upcoming bid.
                      </p>
                    )}
                  </div>
                );
              })}

              {chitPastCycles.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No cycles to confirm yet — start date may be in the future.
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Summary ── */}
          {chitStep === 3 && (
            <div className="space-y-4">
              {/* Key numbers */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Paid so far',         value: formatAmount(chitSummary.totalPaid, homeCurrency) },
                  { label: 'Future payments',      value: formatAmount(chitSummary.futurePayments, homeCurrency) },
                  { label: 'Total committed',      value: formatAmount(chitSummary.totalCommitted, homeCurrency) },
                  {
                    label: chitSummary.hasWon ? 'Bid received' : 'Projected bid',
                    value: chitSummary.hasWon && chitSummary.bidReceived > 0
                      ? formatAmount(chitSummary.bidReceived, homeCurrency)
                      : chitSummary.projectedBid !== null
                        ? `~${formatAmount(chitSummary.projectedBid, homeCurrency)}`
                        : '—',
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Net gain (won) */}
              {chitSummary.netGain !== null && (
                <div className={`rounded-xl p-3 flex items-center justify-between ${chitSummary.netGain >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <span className="text-sm font-medium text-gray-700">Net Gain / Loss</span>
                  <span className={`text-base font-bold ${chitSummary.netGain >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {chitSummary.netGain >= 0 ? '+' : ''}{formatAmount(chitSummary.netGain, homeCurrency)}
                    {chitSummary.gainPct !== null && (
                      <span className="text-xs font-normal ml-1">({chitSummary.gainPct.toFixed(1)}%)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Projected gain (not won) */}
              {!chitSummary.hasWon && chitSummary.projectedGain !== null && (
                <div className="rounded-xl p-3 flex items-center justify-between bg-indigo-50 border border-indigo-100">
                  <span className="text-sm font-medium text-gray-700">Projected Gain</span>
                  <span className={`text-base font-bold ${chitSummary.projectedGain >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                    ~{chitSummary.projectedGain >= 0 ? '+' : ''}{formatAmount(chitSummary.projectedGain, homeCurrency)}
                    <span className="text-xs font-normal ml-1 text-indigo-400">(est.)</span>
                  </span>
                </div>
              )}

              {/* Last bid + Next bid */}
              <div className="space-y-2">
                {chitSummary.lastBidDate && (
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between border bg-gray-50 border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Last bid</p>
                      <p className="text-sm font-bold text-gray-900">{formatDate(chitSummary.lastBidDate)}</p>
                    </div>
                  </div>
                )}
                {chitSummary.nextBidDate && (
                  <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${chitSummary.daysLeft !== null && chitSummary.daysLeft <= 30 && chitSummary.daysLeft >= 0 ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div>
                      <p className="text-xs text-gray-500">Next bid date</p>
                      <p className="text-sm font-bold text-gray-900">{formatDate(chitSummary.nextBidDate)}</p>
                    </div>
                    {chitSummary.daysLeft !== null && chitSummary.daysLeft >= 0 && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${chitSummary.daysLeft <= 7 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'}`}>
                        {chitSummary.daysLeft === 0 ? 'Today!' : `${chitSummary.daysLeft}d away`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cycle progress */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between text-xs text-gray-500">
                <span>Cycles completed</span>
                <span className="font-semibold text-gray-800">
                  {chitSummary.cyclesCompleted} of {chitSummary.totalCycles}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MUTUAL FUNDS — untouched
      ════════════════════════════════════════════════════════════ */}
      {type === 'Mutual Funds' && (
        <>
          <Row>
            <div>
              <Lbl>Folio Number</Lbl>
              <input type="text" value={mfFolio} placeholder="123456789"
                onChange={(e) => setMfFolio(e.target.value)} className={inp} />
            </div>
            <div>
              <Lbl>Scheme Code (for live NAV)</Lbl>
              <input type="number" value={mfCode} placeholder="120503"
                onChange={(e) => { setMfCode(e.target.value); setMfFetchErr(''); }}
                className={inp} />
            </div>
          </Row>

          <div>
            <Lbl>Scheme Name *</Lbl>
            <input type="text" value={mfScheme} placeholder="Axis Bluechip Fund - Growth"
              onChange={(e) => { setMfScheme(e.target.value); clrErr('mfScheme'); }}
              className={inp} />
            <Err msg={errors.mfScheme} />
          </div>

          <Row>
            <div>
              <Lbl>Units *</Lbl>
              <input type="number" min="0" step="0.001" value={mfUnits} placeholder="100"
                onChange={(e) => { setMfUnits(e.target.value); clrErr('mfUnits'); }}
                className={inp} />
              <Err msg={errors.mfUnits} />
            </div>
            <div>
              <Lbl>NAV at Purchase (₹) *</Lbl>
              <input type="number" min="0" step="0.0001" value={mfNavBuy} placeholder="45.23"
                onChange={(e) => { setMfNavBuy(e.target.value); clrErr('mfNavBuy'); }}
                className={inp} />
              <Err msg={errors.mfNavBuy} />
            </div>
          </Row>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={lbl}>Current NAV (₹) *</span>
              {mfCode && (
                <button type="button" onClick={fetchNav} disabled={mfFetching}
                  className="text-xs text-indigo-600 font-semibold hover:underline disabled:opacity-50 flex items-center gap-1">
                  {mfFetching
                    ? <><span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin" /> Fetching…</>
                    : '↻ Fetch Live NAV'}
                </button>
              )}
            </div>
            <input type="number" min="0" step="0.0001" value={mfCurrentNav} placeholder="52.10"
              onChange={(e) => { setMfCurrentNav(e.target.value); clrErr('mfCurrentNav'); }}
              className={inp} />
            {mfFetchErr && <p className="text-xs text-red-500 mt-1">{mfFetchErr}</p>}
            {mfNavDate && !mfFetchErr && <p className="text-xs text-gray-400 mt-1">Updated: {mfNavDate}</p>}
            <Err msg={errors.mfCurrentNav} />
          </div>

          {mfCurrentValue > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-purple-600 mb-3 uppercase tracking-wide">Live Preview</p>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-xs text-purple-400">Units</p>
                  <p className="text-sm font-bold text-purple-900">{mfUnits || '0'}</p></div>
                <div><p className="text-xs text-purple-400">NAV at Buy</p>
                  <p className="text-sm font-bold text-purple-900">{CURRENCIES[homeCurrency]?.symbol ?? homeCurrency}{mfNavBuy || '0'}</p></div>
                <div><p className="text-xs text-purple-400">Current NAV</p>
                  <p className="text-sm font-bold text-purple-900">{CURRENCIES[homeCurrency]?.symbol ?? homeCurrency}{mfCurrentNav || '0'}</p></div>
                <div><p className="text-xs text-purple-400">Invested</p>
                  <p className="text-sm font-bold text-purple-900">{formatAmount(mfInvested, homeCurrency)}</p></div>
                <div className="col-span-2">
                  <p className="text-xs text-purple-400">Current Value</p>
                  <p className="text-sm font-bold text-purple-900">
                    {formatAmount(mfCurrentValue, homeCurrency)}
                    <span className={`text-xs font-semibold ml-2 ${mfGainPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {mfGainPct >= 0 ? '▲' : '▼'} {Math.abs(mfGainPct).toFixed(2)}%
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          GENERIC (Stocks, PPF, Gold, Other) — untouched
      ════════════════════════════════════════════════════════════ */}
      {!['FD', 'Chit Funds', 'Mutual Funds'].includes(type) && (
        <>
          <Row>
            <div>
              <Lbl>Amount Invested (₹) *</Lbl>
              <input type="number" min="0" step="any" value={gInvested} placeholder="50000"
                onChange={(e) => { setGInvested(e.target.value); clrErr('gInvested'); }}
                className={inp} />
              <Err msg={errors.gInvested} />
            </div>
            <div>
              <Lbl>Current Value (₹) *</Lbl>
              <input type="number" min="0" step="any" value={gCurrent} placeholder="54000"
                onChange={(e) => { setGCurrent(e.target.value); clrErr('gCurrent'); }}
                className={inp} />
              <Err msg={errors.gCurrent} />
            </div>
          </Row>
          <div>
            <Lbl>Notes</Lbl>
            <textarea value={gNotes} rows={2} placeholder="Optional notes…"
              onChange={(e) => setGNotes(e.target.value)}
              className={inp + ' resize-none'} />
          </div>
        </>
      )}

      {/* ── Funded by transfer (all types, shown only when remittances exist) ── */}
      {remittances.length > 0 && (!isChit || chitStep === 3) && (
        <div>
          <label className={lbl}>Funded by Transfer</label>
          <select value={remittanceId} onChange={e => setRemittanceId(e.target.value)}
            className={inp + ' bg-white'}>
            <option value="">— None —</option>
            {remittances.map((r) => (
              <option key={r.id} value={r.id}>
                {r.transferDate} · {formatAmount(r.fromAmount, r.fromCurrency)} → {formatAmount(r.toAmount, r.toCurrency)}
                {r.channel ? ` (${r.channel})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ACTION BUTTONS
      ════════════════════════════════════════════════════════════ */}
      <div className="flex gap-3 pt-2">
        {isChit && chitStep > 1 ? (
          <button type="button" onClick={chitBack}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            ← Back
          </button>
        ) : (
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}

        {isChit && chitStep < 3 ? (
          <button type="button" onClick={chitNext}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            Next →
          </button>
        ) : (
          <button type="submit" disabled={submitting}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white
              hover:bg-indigo-700 active:bg-indigo-800 transition-colors
              disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {submitting && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Add Savings'}
          </button>
        )}
      </div>
    </form>
  );
}
