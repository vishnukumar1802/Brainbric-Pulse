import 'server-only';
import { getSetting, setSetting } from './db';
import { focusLabel, serviceInfo, type Focus } from './services';

const DEFAULT: Focus = { service: 'general', product: null, product_details: null, regions: null, notes: null, set_by: null, set_at: null };

export async function getFocus(): Promise<Focus> {
  const raw = await getSetting('focus');
  if (!raw) return DEFAULT;
  try {
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Focus>) };
  } catch {
    return DEFAULT;
  }
}

export async function saveFocus(f: Focus): Promise<void> {
  await setSetting('focus', JSON.stringify(f));
  const history = await focusHistory();
  history.unshift(f);
  await setSetting('focus_history', JSON.stringify(history.slice(0, 10)));
}

export async function focusHistory(): Promise<Focus[]> {
  const raw = await getSetting('focus_history');
  try {
    return raw ? (JSON.parse(raw) as Focus[]) : [];
  } catch {
    return [];
  }
}

/** What the lead agents receive from /api/agent-status: the focus plus the service playbook. */
export function focusForAgents(f: Focus) {
  const s = serviceInfo(f.service);
  return {
    service: s.slug,
    label: focusLabel(f),
    product: f.product,
    product_details: f.product_details,
    regions: f.regions,
    notes: f.notes,
    target: s.target,
    signals: s.signals,
    offer: s.offer,
    sources: s.sources,
    set_by: f.set_by,
    set_at: f.set_at,
  };
}
