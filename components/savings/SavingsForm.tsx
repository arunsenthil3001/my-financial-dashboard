'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavingsEntry, SavingsType } from '@/lib/types';
import { SAVINGS_TYPES } from '@/lib/types';
import { formatCurrency, formatDate, todayISO, addMonths } from '@/lib/utils';
import {
  calcFDValue, fdMaturityDate,
  chitPoolPerBid, chitNextBidDate, chitEndDate,
  calcChitCurrentValue, calcChitMonthlyPayment, chitMonthsRemaining, chitBidTable,
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initial?: SavingsEntry | null;
  onSubmit: (data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// ─── Chit step indicator ──────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {['Fund Basics', 'Your Status', 'Summary'].map((label, i) => {
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
            {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SavingsForm({ initial, onSubmit, onCancel, submitting = false }: Props) {
  // ── Common ──
  const [name, setName]         = useState('');
  const [type, setType]         = useState<SavingsType>('FD');
  const [startDate, setStartDate] = useState(todayISO());
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // ── Generic (Stocks, PPF, Gold, Other) ──
  const [gInvested, setGInvested]   = useState('');
  const [gCurrent, setGCurrent]     = useState('');
  const [gNotes, setGNotes]         = useState('');

  // ── FD ──
  const [fdPrincipal, setFdPrincipal] = useState('');
  const [fdRate, setFdRate]           = useState('');
  const [fdTenure, setFdTenure]       = useState('');
  const [fdFreq, setFdFreq]           = useState<CompoundFrequency>('quarterly');

  // ── Chit Fund (all steps) ──
  const [chitStep, setChitStep]       = useState<1 | 2 | 3>(1);
  const [chitMembers, setChitMembers] = useState('');
  const [chitMonthly, setChitMonthly] = useState('');
  const [chitDuration, setChitDuration] = useState('');
  const [chitForemanPct, setChitForemanPct] = useState('5');
  const [chitIsForeman, setChitIsForeman]   = useState(false);
  const [chitChitType, setChitChitType]     = useState<'new' | 'existing'>('new');
  const [chitBids, setChitBids]             = useState('0');
  const [chitPaid, setChitPaid]             = useState('0');
  const [chitHasBid, setChitHasBid]         = useState(false);
  const [chitBidNum, setChitBidNum]         = useState('');
  const [chitReceived, setChitReceived]     = useState('');
  const [chitDividend, setChitDividend]     = useState('0');

  // ── MF ──
  const [mfFolio, setMfFolio]       = useState('');
  const [mfScheme, setMfScheme]     = useState('');
  const [mfUnits, setMfUnits]       = useState('');
  const [mfNavBuy, setMfNavBuy]     = useState('');
  const [mfCode, setMfCode]         = useState('');
  const [mfCurrentNav, setMfCurrentNav] = useState('');
  const [mfNavDate, setMfNavDate]   = useState('');
  const [mfFetching, setMfFetching] = useState(false);
  const [mfFetchErr, setMfFetchErr] = useState('');

  // ── Populate from `initial` (edit mode) ────────────────────────────────────

  useEffect(() => {
    setErrors({});
    setChitStep(1);
    if (!initial) {
      setName(''); setType('FD'); setStartDate(todayISO());
      setGInvested(''); setGCurrent(''); setGNotes('');
      setFdPrincipal(''); setFdRate(''); setFdTenure(''); setFdFreq('quarterly');
      setChitMembers(''); setChitMonthly(''); setChitDuration(''); setChitForemanPct('5');
      setChitIsForeman(false); setChitChitType('new'); setChitBids('0'); setChitPaid('0');
      setChitHasBid(false); setChitBidNum(''); setChitReceived(''); setChitDividend('0');
      setMfFolio(''); setMfScheme(''); setMfUnits(''); setMfNavBuy('');
      setMfCode(''); setMfCurrentNav(''); setMfNavDate(''); setMfFetchErr('');
      return;
    }
    setName(initial.name);
    setType(initial.type);
    setStartDate(initial.startDate);

    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(initial.notes); } catch { /* plain text */ }

    if (initial.type === 'FD') {
      setFdPrincipal(String(initial.amountInvested));
      setFdRate(String(meta.interest_rate ?? ''));
      setFdTenure(String(meta.tenure_months ?? ''));
      setFdFreq((meta.compound_frequency as CompoundFrequency) ?? 'quarterly');
    } else if (initial.type === 'Chit Funds') {
      setChitMembers(String(meta.total_members ?? ''));
      setChitMonthly(String(meta.monthly_contribution ?? ''));
      setChitDuration(String(meta.total_duration_months ?? ''));
      setChitForemanPct(String(meta.foreman_commission_pct ?? '5'));
      setChitIsForeman(Boolean(meta.is_foreman));
      setChitChitType((meta.bids_completed as number) > 0 ? 'existing' : 'new');
      setChitBids(String(meta.bids_completed ?? '0'));
      setChitPaid(String(meta.amount_paid_so_far ?? '0'));
      setChitHasBid(Boolean(meta.user_has_taken_bid));
      setChitBidNum(meta.which_bid_number != null ? String(meta.which_bid_number) : '');
      setChitReceived(meta.amount_received != null ? String(meta.amount_received) : '');
      setChitDividend(String(meta.accumulated_dividend ?? '0'));
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
  }, [initial]);

  // ── FD derived values ──────────────────────────────────────────────────────

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

  // ── Chit derived values ────────────────────────────────────────────────────

  const chitBidInterval = useMemo(() => {
    const m = Number(chitMembers), d = Number(chitDuration);
    return m > 0 ? d / m : 0;
  }, [chitMembers, chitDuration]);

  const chitEndDateStr = useMemo(
    () => (startDate && chitDuration ? addMonths(startDate, Number(chitDuration)) : ''),
    [startDate, chitDuration],
  );

  const chitMeta = useMemo(() => ({
    total_members: Number(chitMembers),
    monthly_contribution: Number(chitMonthly),
    total_duration_months: Number(chitDuration),
    bid_interval: chitBidInterval,
    foreman_commission_pct: Number(chitForemanPct),
    is_foreman: chitIsForeman,
    bids_completed: chitIsForeman ? 1 : Number(chitBids),
    amount_paid_so_far: Number(chitPaid),
    user_has_taken_bid: chitIsForeman ? true : chitHasBid,
    accumulated_dividend: Number(chitDividend),
    which_bid_number: chitHasBid && chitBidNum ? Number(chitBidNum) : null,
    amount_received: chitIsForeman
      ? chitPoolPerBid({ total_members: Number(chitMembers), monthly_contribution: Number(chitMonthly), bid_interval: chitBidInterval } as Parameters<typeof chitPoolPerBid>[0])
      : (chitHasBid && chitReceived ? Number(chitReceived) : null),
  }), [chitMembers, chitMonthly, chitDuration, chitBidInterval, chitForemanPct,
       chitIsForeman, chitBids, chitPaid, chitHasBid, chitBidNum, chitReceived, chitDividend]);

  const chitPoolValue  = useMemo(() => chitPoolPerBid(chitMeta as Parameters<typeof chitPoolPerBid>[0]), [chitMeta]);
  const chitNextBid    = useMemo(() => chitNextBidDate(startDate, chitMeta as Parameters<typeof chitNextBidDate>[1]), [startDate, chitMeta]);
  const chitCurrentVal = useMemo(() => calcChitCurrentValue(chitMeta as Parameters<typeof calcChitCurrentValue>[0]), [chitMeta]);
  const chitMonthlyPmt = useMemo(() => calcChitMonthlyPayment(chitMeta as Parameters<typeof calcChitMonthlyPayment>[0]), [chitMeta]);
  const chitRemaining  = useMemo(() => chitMonthsRemaining(chitMeta as Parameters<typeof chitMonthsRemaining>[0]), [chitMeta]);
  const chitTable      = useMemo(() => chitBidTable(chitMeta as Parameters<typeof chitBidTable>[0]), [chitMeta]);
  const chitCommission = useMemo(() => (chitPoolValue * Number(chitForemanPct)) / 100, [chitPoolValue, chitForemanPct]);
  const chitUsable     = chitPoolValue - chitCommission;

  // ── MF derived values ──────────────────────────────────────────────────────

  const mfInvested     = useMemo(() => Number(mfUnits) * Number(mfNavBuy), [mfUnits, mfNavBuy]);
  const mfCurrentValue = useMemo(() => Number(mfUnits) * Number(mfCurrentNav), [mfUnits, mfCurrentNav]);
  const mfGainPct      = mfInvested > 0 ? ((mfCurrentValue - mfInvested) / mfInvested) * 100 : 0;

  // ── MF NAV fetch ───────────────────────────────────────────────────────────

  const fetchNav = useCallback(async () => {
    if (!mfCode.trim()) return;
    setMfFetching(true);
    setMfFetchErr('');
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
    } catch {
      setMfFetchErr('Network error — check your connection');
    } finally {
      setMfFetching(false);
    }
  }, [mfCode, mfScheme]);

  // ── Validation helpers ─────────────────────────────────────────────────────

  const setErr = (k: string, v: string) => setErrors((p) => ({ ...p, [k]: v }));
  const clrErr = (k: string) => setErrors((p) => { const n = { ...p }; delete n[k]; return n; });

  function validateCommon() {
    let ok = true;
    if (!name.trim()) { setErr('name', 'Name is required'); ok = false; }
    if (!startDate) { setErr('startDate', 'Date is required'); ok = false; }
    return ok;
  }

  function validateFD() {
    let ok = validateCommon();
    if (!fdPrincipal || Number(fdPrincipal) <= 0) { setErr('fdPrincipal', 'Enter amount'); ok = false; }
    if (!fdRate || Number(fdRate) <= 0) { setErr('fdRate', 'Enter interest rate'); ok = false; }
    if (!fdTenure || Number(fdTenure) <= 0) { setErr('fdTenure', 'Enter tenure'); ok = false; }
    return ok;
  }

  function validateChitStep1() {
    let ok = validateCommon();
    if (!chitMembers || Number(chitMembers) < 2) { setErr('chitMembers', 'Min 2 members'); ok = false; }
    if (!chitMonthly || Number(chitMonthly) <= 0) { setErr('chitMonthly', 'Enter monthly amount'); ok = false; }
    if (!chitDuration || Number(chitDuration) <= 0) { setErr('chitDuration', 'Enter duration'); ok = false; }
    if (!chitForemanPct || Number(chitForemanPct) < 0) { setErr('chitForemanPct', 'Enter commission'); ok = false; }
    return ok;
  }

  function validateChitStep2() {
    let ok = true;
    if (chitChitType === 'existing') {
      if (Number(chitPaid) < 0) { setErr('chitPaid', 'Enter valid amount'); ok = false; }
      if (chitHasBid && !chitIsForeman && !chitReceived) {
        setErr('chitReceived', 'Enter amount received'); ok = false;
      }
    }
    return ok;
  }

  function validateMF() {
    let ok = validateCommon();
    if (!mfScheme.trim()) { setErr('mfScheme', 'Scheme name required'); ok = false; }
    if (!mfUnits || Number(mfUnits) <= 0) { setErr('mfUnits', 'Enter units'); ok = false; }
    if (!mfNavBuy || Number(mfNavBuy) <= 0) { setErr('mfNavBuy', 'Enter NAV at purchase'); ok = false; }
    if (!mfCurrentNav || Number(mfCurrentNav) <= 0) { setErr('mfCurrentNav', 'Enter current NAV'); ok = false; }
    return ok;
  }

  function validateGeneric() {
    let ok = validateCommon();
    if (!gInvested || Number(gInvested) < 0) { setErr('gInvested', 'Enter amount'); ok = false; }
    if (!gCurrent  || Number(gCurrent)  < 0) { setErr('gCurrent',  'Enter current value'); ok = false; }
    return ok;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrors({});

    if (type === 'FD') {
      if (!validateFD()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Number(fdPrincipal),
        currentValue: Math.round(fdCurrentValue * 100) / 100,
        notes: JSON.stringify({
          interest_rate: Number(fdRate),
          tenure_months: Number(fdTenure),
          compound_frequency: fdFreq,
        }),
      });

    } else if (type === 'Chit Funds') {
      if (!validateChitStep1() || !validateChitStep2()) return;
      const finalMeta = {
        total_members: Number(chitMembers),
        monthly_contribution: Number(chitMonthly),
        total_duration_months: Number(chitDuration),
        bid_interval: chitBidInterval,
        foreman_commission_pct: Number(chitForemanPct),
        is_foreman: chitIsForeman,
        bids_completed: chitIsForeman ? 1 : Number(chitBids),
        amount_paid_so_far: Number(chitPaid),
        user_has_taken_bid: chitIsForeman || chitHasBid,
        accumulated_dividend: Number(chitDividend),
        which_bid_number: chitHasBid && chitBidNum ? Number(chitBidNum) : null,
        amount_received: chitIsForeman
          ? chitPoolValue
          : (chitHasBid && chitReceived ? Number(chitReceived) : null),
      };
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Number(chitPaid),
        currentValue: calcChitCurrentValue(finalMeta),
        notes: JSON.stringify(finalMeta),
      });

    } else if (type === 'Mutual Funds') {
      if (!validateMF()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Math.round(mfInvested * 100) / 100,
        currentValue: Math.round(mfCurrentValue * 100) / 100,
        notes: JSON.stringify({
          folio: mfFolio.trim(),
          scheme_name: mfScheme.trim(),
          units: Number(mfUnits),
          nav_at_purchase: Number(mfNavBuy),
          current_nav: Number(mfCurrentNav),
          scheme_code: mfCode ? Number(mfCode) : null,
          nav_updated_date: mfNavDate,
        }),
      });

    } else {
      if (!validateGeneric()) return;
      onSubmit({
        name: name.trim(), type, startDate,
        amountInvested: Number(gInvested),
        currentValue: Number(gCurrent),
        notes: gNotes.trim(),
      });
    }
  };

  // ── Chit next/back ─────────────────────────────────────────────────────────

  const chitNext = () => {
    setErrors({});
    if (chitStep === 1 && !validateChitStep1()) return;
    if (chitStep === 2 && !validateChitStep2()) return;
    setChitStep((s) => Math.min(3, s + 1) as 1 | 2 | 3);
  };
  const chitBack = () => setChitStep((s) => Math.max(1, s - 1) as 1 | 2 | 3);

  const isChit = type === 'Chit Funds';

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Common: Name + Type ─── */}
      {/* Hide common fields in chit steps 2 & 3 to save space */}
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
          FD SECTION
      ════════════════════════════════════════════════════════════ */}
      {type === 'FD' && (
        <>
          <div>
            <Lbl>Amount Invested (₹) *</Lbl>
            <input type="number" min="0" step="any" value={fdPrincipal}
              placeholder="100000"
              onChange={(e) => { setFdPrincipal(e.target.value); clrErr('fdPrincipal'); }}
              className={inp} />
            <Err msg={errors.fdPrincipal} />
          </div>

          <Row>
            <div>
              <Lbl>Interest Rate (% p.a.) *</Lbl>
              <input type="number" min="0" step="0.01" value={fdRate}
                placeholder="7.5"
                onChange={(e) => { setFdRate(e.target.value); clrErr('fdRate'); }}
                className={inp} />
              <Err msg={errors.fdRate} />
            </div>
            <div>
              <Lbl>Tenure (months) *</Lbl>
              <input type="number" min="1" step="1" value={fdTenure}
                placeholder="24"
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

          {/* Live preview */}
          {fdCurrentValue > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-600 mb-3 uppercase tracking-wide">Live Preview</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-blue-400">Invested</p>
                  <p className="text-sm font-bold text-blue-900">{formatCurrency(Number(fdPrincipal))}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-400">Maturity Value</p>
                  <p className="text-sm font-bold text-blue-900">{formatCurrency(fdCurrentValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-400">Gain</p>
                  <p className="text-sm font-bold text-emerald-700">
                    +{formatCurrency(fdCurrentValue - Number(fdPrincipal))}
                    <span className="text-xs font-normal ml-1">({fdGainPct.toFixed(2)}%)</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-400">Maturity Date</p>
                  <p className="text-sm font-bold text-blue-900">{fdMaturity ? formatDate(fdMaturity) : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          CHIT FUND SECTION (3-step wizard)
      ════════════════════════════════════════════════════════════ */}
      {type === 'Chit Funds' && (
        <div className="space-y-4">
          <StepBar step={chitStep} />

          {/* ── Step 1: Fund Basics ── */}
          {chitStep === 1 && (
            <>
              <Row>
                <div>
                  <Lbl>Total Members *</Lbl>
                  <input type="number" min="2" step="1" value={chitMembers}
                    placeholder="10"
                    onChange={(e) => { setChitMembers(e.target.value); clrErr('chitMembers'); }}
                    className={inp} />
                  <Err msg={errors.chitMembers} />
                </div>
                <div>
                  <Lbl>Monthly Contribution (₹) *</Lbl>
                  <input type="number" min="1" step="any" value={chitMonthly}
                    placeholder="10000"
                    onChange={(e) => { setChitMonthly(e.target.value); clrErr('chitMonthly'); }}
                    className={inp} />
                  <Err msg={errors.chitMonthly} />
                </div>
              </Row>

              <Row>
                <div>
                  <Lbl>Duration (months) *</Lbl>
                  <input type="number" min="1" step="1" value={chitDuration}
                    placeholder="60"
                    onChange={(e) => { setChitDuration(e.target.value); clrErr('chitDuration'); }}
                    className={inp} />
                  <Err msg={errors.chitDuration} />
                </div>
                <div>
                  <Lbl>Foreman Commission (%) *</Lbl>
                  <input type="number" min="0" max="20" step="0.5" value={chitForemanPct}
                    onChange={(e) => { setChitForemanPct(e.target.value); clrErr('chitForemanPct'); }}
                    className={inp} />
                  <Err msg={errors.chitForemanPct} />
                </div>
              </Row>

              {/* Are you the foreman? */}
              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-900">Are you the foreman?</p>
                  <p className="text-xs text-amber-600 mt-0.5">Foreman receives the full pool at bid #1</p>
                </div>
                <button type="button"
                  onClick={() => setChitIsForeman((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${chitIsForeman ? 'bg-amber-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${chitIsForeman ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Auto-computed read-only stats */}
              {chitMembers && chitMonthly && chitDuration && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Total Pool</span>
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(Number(chitMembers) * Number(chitMonthly) * Number(chitDuration))}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Bid every</span>
                    <span className="font-semibold text-gray-800">
                      {chitBidInterval.toFixed(1)} months
                    </span>
                  </div>
                  {chitEndDateStr && (
                    <div className="flex justify-between text-gray-500">
                      <span>End Date</span>
                      <span className="font-semibold text-gray-800">{formatDate(chitEndDateStr)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Current Status ── */}
          {chitStep === 2 && (
            <>
              {/* New / Existing toggle */}
              <div>
                <Lbl>Chit Status</Lbl>
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {(['new', 'existing'] as const).map((opt) => (
                    <button key={opt} type="button"
                      onClick={() => {
                        setChitChitType(opt);
                        if (opt === 'new') {
                          setChitBids('0'); setChitPaid('0');
                          setChitHasBid(false); setChitBidNum(''); setChitReceived(''); setChitDividend('0');
                        }
                      }}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${chitChitType === opt ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {opt === 'new' ? '🆕 New Chit' : '📋 Existing Chit'}
                    </button>
                  ))}
                </div>
              </div>

              {chitChitType === 'existing' && !chitIsForeman && (
                <>
                  <Row>
                    <div>
                      <Lbl>Bids Completed</Lbl>
                      <input type="number" min="0" step="1" value={chitBids}
                        onChange={(e) => setChitBids(e.target.value)} className={inp} />
                    </div>
                    <div>
                      <Lbl>Amount Paid So Far (₹)</Lbl>
                      <input type="number" min="0" step="any" value={chitPaid}
                        onChange={(e) => { setChitPaid(e.target.value); clrErr('chitPaid'); }}
                        className={inp} />
                      <Err msg={errors.chitPaid} />
                    </div>
                  </Row>

                  {/* Have you taken a bid? */}
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-indigo-900">Have you taken a bid?</p>
                    <button type="button"
                      onClick={() => { setChitHasBid((v) => !v); if (chitHasBid) { setChitBidNum(''); setChitReceived(''); } }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${chitHasBid ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${chitHasBid ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {chitHasBid && (
                    <Row>
                      <div>
                        <Lbl>Bid Number (e.g. 3)</Lbl>
                        <input type="number" min="1" step="1" value={chitBidNum}
                          placeholder="3"
                          onChange={(e) => setChitBidNum(e.target.value)} className={inp} />
                      </div>
                      <div>
                        <Lbl>Amount Received (₹) *</Lbl>
                        <input type="number" min="0" step="any" value={chitReceived}
                          placeholder="135000"
                          onChange={(e) => { setChitReceived(e.target.value); clrErr('chitReceived'); }}
                          className={inp} />
                        <Err msg={errors.chitReceived} />
                      </div>
                    </Row>
                  )}

                  {!chitHasBid && (
                    <div>
                      <Lbl>Accumulated Dividend Received (₹)</Lbl>
                      <input type="number" min="0" step="any" value={chitDividend}
                        placeholder="0"
                        onChange={(e) => setChitDividend(e.target.value)} className={inp} />
                      <p className="text-xs text-gray-400 mt-1">
                        Total dividend received from other members&apos; bids
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Foreman step 2 */}
              {chitIsForeman && (
                <div className="space-y-3">
                  <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800">
                    <b>Foreman:</b> You received the full pool at bid #1.
                    Amount received = {formatCurrency(chitPoolValue)}.
                  </div>
                  <div>
                    <Lbl>Amount Paid Back So Far (₹)</Lbl>
                    <input type="number" min="0" step="any" value={chitPaid}
                      onChange={(e) => setChitPaid(e.target.value)} className={inp} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Calculated Summary ── */}
          {chitStep === 3 && (
            <div className="space-y-4">
              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Next Bid Date', value: chitNextBid ? formatDate(chitNextBid) : '—' },
                  { label: 'Months Remaining', value: `${chitRemaining.toFixed(0)} months` },
                  { label: 'Your Monthly Payment', value: formatCurrency(chitMonthlyPmt) },
                  { label: 'Net Position', value: formatCurrency(chitCurrentVal), colored: true },
                ].map(({ label, value, colored }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className={`text-sm font-bold ${colored ? (chitCurrentVal >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-gray-900'}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pool breakdown */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-900 mb-1">Pool per bid ({chitBidInterval.toFixed(0)} months)</p>
                <div className="flex justify-between text-amber-700">
                  <span>Pool</span><span>{formatCurrency(chitPoolValue)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Foreman commission ({chitForemanPct}%)</span>
                  <span>−{formatCurrency(chitCommission)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-900 pt-1 border-t border-amber-200">
                  <span>Usable pool</span><span>{formatCurrency(chitUsable)}</span>
                </div>
              </div>

              {/* Bid comparison table (only if bids have happened) */}
              {Number(chitBids) >= 1 || chitIsForeman ? (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                    Bid Comparison Table
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Discount</th>
                          <th className="text-right px-3 py-2 font-medium">You Receive</th>
                          <th className="text-right px-3 py-2 font-medium">Dividend/member</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chitTable.map((row) => (
                          <tr key={row.discount}
                            className={`border-t border-gray-50 ${row.discount === 10 ? 'bg-emerald-50' : 'bg-white'}`}>
                            <td className="px-3 py-2 font-medium text-gray-700">
                              {row.discount}%
                              {row.discount === 10 && (
                                <span className="ml-1.5 text-emerald-600 font-semibold">← min</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              {formatCurrency(row.youReceive)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {formatCurrency(row.dividendPerMember)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MUTUAL FUNDS SECTION
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

          {/* Current NAV + Fetch */}
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
            {mfNavDate && !mfFetchErr && (
              <p className="text-xs text-gray-400 mt-1">Updated: {mfNavDate}</p>
            )}
            <Err msg={errors.mfCurrentNav} />
          </div>

          {/* Live preview */}
          {mfCurrentValue > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-purple-600 mb-3 uppercase tracking-wide">Live Preview</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-purple-400">Units</p>
                  <p className="text-sm font-bold text-purple-900">{mfUnits || '0'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400">NAV at Buy</p>
                  <p className="text-sm font-bold text-purple-900">₹{mfNavBuy || '0'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400">Current NAV</p>
                  <p className="text-sm font-bold text-purple-900">₹{mfCurrentNav || '0'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400">Invested</p>
                  <p className="text-sm font-bold text-purple-900">{formatCurrency(mfInvested)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-purple-400">Current Value</p>
                  <p className="text-sm font-bold text-purple-900">
                    {formatCurrency(mfCurrentValue)}
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
          GENERIC (Stocks, PPF, Gold, Other)
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

      {/* ════════════════════════════════════════════════════════════
          ACTION BUTTONS
      ════════════════════════════════════════════════════════════ */}
      <div className="flex gap-3 pt-2">
        {/* Left button */}
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

        {/* Right button */}
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
