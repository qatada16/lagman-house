import { useCallback } from 'react';
import { Asset } from 'expo-asset';
import type { Order, OrderItem, ReceiptTemplate } from '@/lib/types';
import { buildReceiptNodes, type ReceiptNode } from '@/features/receipts/render';
import { getSettings } from '@/features/settings/settingsRepo';
import { usePrinterStore } from '@/store/printerStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { useT } from '@/lib/i18n';

let logoPathCache: string | null = null;

export async function resolveLogoPath(): Promise<string | null> {
  if (logoPathCache) return logoPathCache;
  try {
    const asset = Asset.fromModule(require('@/assets/brand/logo-print.png'));
    await asset.downloadAsync();
    logoPathCache = (asset.localUri ?? asset.uri).replace(/^file:\/\//, '');
    return logoPathCache;
  } catch {
    return null;
  }
}

export function usePrint() {
  const t = useT();
  const print = usePrinterStore((s) => s.print);
  const device = usePrinterStore((s) => s.device);
  const printing = usePrinterStore((s) => s.printing);
  const profile = useAuthStore((s) => s.profile);

  const printOrder = useCallback(
    async (order: Order, items: OrderItem[], template: ReceiptTemplate, cashierName?: string | null) => {
      if (!device) {
        toast.error(t('connectPrinterFirst'));
        return false;
      }
      try {
        const logoPath = template.config.header.showLogo ? await resolveLogoPath() : null;
        const nodes = buildReceiptNodes(order, items, template, {
          settings: getSettings(),
          cashierName: cashierName ?? profile?.name ?? null,
          logoPath,
        });
        await print(nodes, template.config.paperWidthMm);
        toast.success(t('printed'));
        return true;
      } catch (e) {
        toast.error(`${t('printFailed')}: ${(e as Error).message}`);
        return false;
      }
    },
    [device, print, profile?.name, t]
  );

  const printRaw = useCallback(
    async (nodes: ReceiptNode[], paperWidthMm: number) => {
      if (!device) {
        toast.error(t('connectPrinterFirst'));
        return false;
      }
      try {
        await print(nodes, paperWidthMm);
        toast.success(t('printed'));
        return true;
      } catch (e) {
        toast.error(`${t('printFailed')}: ${(e as Error).message}`);
        return false;
      }
    },
    [device, print, t]
  );

  return { printOrder, printRaw, printing, hasPrinter: !!device };
}

export function testSlipNodes(restaurantName: string): ReceiptNode[] {
  return [
    { type: 'text', content: restaurantName, style: { align: 'center', bold: true, size: 2 } },
    { type: 'text', content: 'Printer test', style: { align: 'center' } },
    { type: 'line' },
    { type: 'columns', columns: [{ content: 'Left column', width: 50 }, { content: 'Right', width: 50, align: 'right' }] },
    { type: 'text', content: '0123456789 ABCDEFGHIJ abcdefghij' },
    { type: 'text', content: 'Bold line', style: { bold: true } },
    { type: 'line', style: 'dashed' },
    { type: 'text', content: new Date().toLocaleString(), style: { align: 'center' } },
    { type: 'feed', lines: 3 },
    { type: 'cut' },
  ];
}
