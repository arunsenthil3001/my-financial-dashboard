/**
 * Server-side only — fetches holdings from Upstox API and orchestrates sync.
 * Never import this in client components.
 */

import { getValidToken, markSynced } from './client';
import { upsertStockHoldings, upsertMFHoldings, type UpsertResult } from './upsert';

const UPSTOX_BASE = 'https://api.upstox.com/v2';

// ── Upstox response shapes ────────────────────────────────────────────────────

interface UpstoxStockRaw {
  company_name?: string;
  tradingsymbol?: string;
  quantity: number;
  average_price: number;
  last_price: number;
}

interface UpstoxMFRaw {
  fund: string;
  quantity: number;
  average_price: number;
  last_price: number;
  folio?: string;
}

// ── Normalised holding shapes (exported for upsert.ts) ───────────────────────

export interface StockHolding {
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  amountInvested: number;
  currentValue: number;
}

export interface MFHolding {
  name: string;
  units: number;
  averageNav: number;
  currentNav: number;
  amountInvested: number;
  currentValue: number;
  folio: string;
}

export interface SyncResult {
  stocks:      UpsertResult;
  mutualFunds: UpsertResult;
}

// ── Private fetch helper ──────────────────────────────────────────────────────

async function upstoxGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${UPSTOX_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`UPSTOX_API_ERROR: ${path} → ${res.status} ${text}`);
  }

  const json = JSON.parse(text) as { status: string; data: unknown };

  if (json.status !== 'success') {
    throw new Error(`UPSTOX_API_ERROR: ${path} → ${JSON.stringify(json)}`);
  }

  return json.data;
}

// ── Holdings fetchers ─────────────────────────────────────────────────────────

export async function fetchStockHoldings(accessToken: string): Promise<StockHolding[]> {
  const data = await upstoxGet('/portfolio/long-term-holdings', accessToken);
  if (!Array.isArray(data)) return [];

  return (data as UpstoxStockRaw[]).map(h => ({
    name:           h.company_name ?? h.tradingsymbol ?? 'Unknown',
    quantity:       h.quantity,
    averagePrice:   h.average_price,
    currentPrice:   h.last_price,
    amountInvested: h.quantity * h.average_price,
    currentValue:   h.quantity * h.last_price,
  }));
}

export async function fetchMFHoldings(accessToken: string): Promise<MFHolding[]> {
  const data = await upstoxGet('/mf/holdings', accessToken);
  if (!Array.isArray(data)) return [];

  return (data as UpstoxMFRaw[]).map(h => ({
    name:           h.fund,
    units:          h.quantity,
    averageNav:     h.average_price,
    currentNav:     h.last_price,
    amountInvested: h.quantity * h.average_price,
    currentValue:   h.quantity * h.last_price,
    folio:          h.folio ?? '',
  }));
}

// ── Full sync orchestrator ────────────────────────────────────────────────────

export async function runFullSync(): Promise<SyncResult> {
  const accessToken = await getValidToken();

  const [stocks, mfs] = await Promise.all([
    fetchStockHoldings(accessToken),
    fetchMFHoldings(accessToken),
  ]);

  const [stockResult, mfResult] = await Promise.all([
    upsertStockHoldings(stocks),
    upsertMFHoldings(mfs),
  ]);

  await markSynced();

  console.log(`[Upstox] Sync complete — stocks: ${stockResult.synced}, MF: ${mfResult.synced}`);
  if (stockResult.errors.length) console.error('[Upstox] Stock errors:', stockResult.errors);
  if (mfResult.errors.length)    console.error('[Upstox] MF errors:',    mfResult.errors);

  return { stocks: stockResult, mutualFunds: mfResult };
}
