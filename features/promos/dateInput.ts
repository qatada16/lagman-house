import { formatDateTime } from '@/lib/format';

// Accepts YYYY-MM-DD or YYYY-MM-DD HH:MM in local time. Empty means no limit.
export function parseDateTimeInput(text: string, endOfDay = false): string | null | undefined {
  const v = text.trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(v);
  if (!m) return undefined;
  const hasTime = m[4] != null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hasTime ? Number(m[4]) : endOfDay ? 23 : 0, hasTime ? Number(m[5]) : endOfDay ? 59 : 0, endOfDay && !hasTime ? 59 : 0);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function dateTimeInputValue(iso: string | null) {
  return iso ? formatDateTime(iso) : '';
}

export function windowStatus(startsAt: string | null, endsAt: string | null): 'always' | 'active' | 'scheduled' | 'expired' {
  const now = Date.now();
  if (!startsAt && !endsAt) return 'always';
  if (startsAt && new Date(startsAt).getTime() > now) return 'scheduled';
  if (endsAt && new Date(endsAt).getTime() < now) return 'expired';
  return 'active';
}
