import { DataSource, EntityManager } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';

/** States and union territories with their GST state codes. */
export const INDIAN_STATES: Array<[string, string]> = [
  ['Andaman and Nicobar Islands', '35'], ['Andhra Pradesh', '37'], ['Arunachal Pradesh', '12'], ['Assam', '18'],
  ['Bihar', '10'], ['Chandigarh', '04'], ['Chhattisgarh', '22'], ['Dadra and Nagar Haveli and Daman and Diu', '26'],
  ['Delhi', '07'], ['Goa', '30'], ['Gujarat', '24'], ['Haryana', '06'], ['Himachal Pradesh', '02'],
  ['Jammu and Kashmir', '01'], ['Jharkhand', '20'], ['Karnataka', '29'], ['Kerala', '32'], ['Ladakh', '38'],
  ['Lakshadweep', '31'], ['Madhya Pradesh', '23'], ['Maharashtra', '27'], ['Manipur', '14'], ['Meghalaya', '17'],
  ['Mizoram', '15'], ['Nagaland', '13'], ['Odisha', '21'], ['Puducherry', '34'], ['Punjab', '03'],
  ['Rajasthan', '08'], ['Sikkim', '11'], ['Tamil Nadu', '33'], ['Telangana', '36'], ['Tripura', '16'],
  ['Uttar Pradesh', '09'], ['Uttarakhand', '05'], ['West Bengal', '19'],
];
const STATE_NAMES = new Set(INDIAN_STATES.map(([n]) => n));

export function isIndianState(value: unknown): value is string {
  return typeof value === 'string' && STATE_NAMES.has(value);
}

export function stateCode(state: string | null | undefined): string | null {
  return INDIAN_STATES.find(([n]) => n === state)?.[1] ?? null;
}

export interface GstConfig {
  enabled: boolean;
  gstin: string;
  legalName: string;
  address: string;
  state: string;
  ratePct: number;
  sac: string;
  prefix: string;
}

export async function gstConfig(dataSource: DataSource | EntityManager): Promise<GstConfig> {
  const keys = ['GST_ENABLED', 'GSTIN', 'GST_LEGAL_NAME', 'GST_ADDRESS', 'GST_STATE', 'GST_RATE_PCT', 'GST_SAC', 'INVOICE_PREFIX'];
  const rows = await dataSource.getRepository(PlatformSetting).find({ where: keys.map((key) => ({ key })) });
  const get = (k: string) => (rows.find((r) => r.key === k)?.value ?? SETTING_DEFAULTS[k].value).trim();
  const gstin = get('GSTIN').toUpperCase();
  return {
    // Only real once a GSTIN is in — "enabled" with no GSTIN would print invalid invoices.
    enabled: get('GST_ENABLED') === 'true' && /^[0-9A-Z]{15}$/.test(gstin),
    gstin,
    legalName: get('GST_LEGAL_NAME'),
    address: get('GST_ADDRESS'),
    state: get('GST_STATE'),
    ratePct: Number(get('GST_RATE_PCT')) || 18,
    sac: get('GST_SAC'),
    prefix: get('INVOICE_PREFIX') || 'HKU',
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Splits a GST-inclusive amount. Same state as ours (or unknown, which by law means our location)
 * → CGST + SGST halves; another state → IGST.
 */
export function splitInclusiveGst(total: number, ratePct: number, supplierState: string, customerState: string | null) {
  const taxable = round2((total * 100) / (100 + ratePct));
  const tax = round2(total - taxable);
  const placeOfSupply = customerState && isIndianState(customerState) ? customerState : supplierState;
  if (placeOfSupply === supplierState) {
    const cgst = round2(tax / 2);
    return { taxable, cgst, sgst: round2(tax - cgst), igst: 0, tax, placeOfSupply };
  }
  return { taxable, cgst: 0, sgst: 0, igst: tax, tax, placeOfSupply };
}

/** Indian financial year (April–March) in IST, e.g. "2026-27". */
export function financialYear(date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Next invoice number in the year's series, gap-free under concurrency. Test orders get their own series. */
export async function nextInvoiceNumber(manager: EntityManager, prefix: string, isTest: boolean, date = new Date()): Promise<string> {
  const fy = financialYear(date);
  const series = `${isTest ? 'TEST-' : ''}${prefix}/${fy}`;
  const [{ last }] = await manager.query(
    `INSERT INTO invoice_counters (series, last) VALUES ($1, 1)
     ON CONFLICT (series) DO UPDATE SET last = invoice_counters.last + 1
     RETURNING last`,
    [series],
  );
  return `${series}/${String(last).padStart(6, '0')}`;
}
