export interface ScannedDevice {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  majorClass: number;
  deviceClass: number;
  paired: boolean;
}

const MAJOR_IMAGING = 0x0600;
const MAJOR_UNCATEGORIZED = 0x1f00;
const MAJOR_AUDIO_VIDEO = 0x0400;
const MAJOR_PHONE = 0x0200;
const MAJOR_COMPUTER = 0x0100;
const MAJOR_WEARABLE = 0x0700;
const MAJOR_PERIPHERAL = 0x0500;
const PRINTER_MINOR_BIT = 0x80;

const NAME_HINTS = [
  /print/i,
  /\bpos\b/i,
  /thermal/i,
  /receipt/i,
  /^(pt|mpt|rpp|xp|zj|gp|hm|tp|mtp|ql|tm|qs|sp|dp|lp|bp|cs|sm)[-_ ]?\d/i,
  /xprinter|rongta|goojprt|peripage|munbyn|hprt|zjiang|sunmi|bixolon|epson|star|citizen|zebra|niimbot|phomemo|memobird|paperang|issyzone|netum|hoin|milestone/i,
  /\b(58|80)\s?mm\b/i,
  /^bt[-_ ]?(printer|pos)/i,
];

const NOT_PRINTER = /airpods|buds|headset|headphone|earphone|speaker|soundbar|watch|band|tv|car|keyboard|mouse|galaxy|iphone|ipad|pixel|redmi|oppo|vivo|realme|laptop|pc\b|jbl|bose|sony wh|beats/i;

// Higher score means more likely to be a receipt printer.
export function printerScore(d: Pick<ScannedDevice, 'name' | 'majorClass' | 'deviceClass' | 'deviceType'>): number {
  let score = 0;
  if (d.majorClass === MAJOR_IMAGING) score += (d.deviceClass & PRINTER_MINOR_BIT) ? 6 : 4;
  if (d.majorClass === MAJOR_UNCATEGORIZED || d.majorClass === -1) score += 1;
  if ([MAJOR_AUDIO_VIDEO, MAJOR_PHONE, MAJOR_COMPUTER, MAJOR_WEARABLE, MAJOR_PERIPHERAL].includes(d.majorClass)) score -= 4;
  for (const re of NAME_HINTS) if (re.test(d.name)) score += 3;
  if (NOT_PRINTER.test(d.name)) score -= 5;
  if (d.deviceType === 'ble') score -= 2;
  return score;
}

export function isLikelyPrinter(d: Parameters<typeof printerScore>[0]) {
  return printerScore(d) >= 3;
}

export function parseDeviceList(raw: unknown, paired: boolean): ScannedDevice[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && typeof (d as { address?: unknown }).address === 'string')
    .map((d) => ({
      name: typeof d.name === 'string' && d.name ? d.name : String(d.address),
      address: String(d.address).replace(/^(bt|ble):/, ''),
      deviceType: (['bt', 'ble', 'dual'].includes(String(d.deviceType)) ? d.deviceType : 'unknown') as ScannedDevice['deviceType'],
      majorClass: typeof d.majorClass === 'number' ? d.majorClass : -1,
      deviceClass: typeof d.deviceClass === 'number' ? d.deviceClass : -1,
      paired,
    }));
}

export function parseDevice(raw: unknown): ScannedDevice | null {
  if (typeof raw !== 'string') return null;
  try {
    return parseDeviceList([JSON.parse(raw)], false)[0] ?? null;
  } catch {
    return null;
  }
}
