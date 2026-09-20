import { useConfirmStore } from '@/store/confirmStore';

export function confirm(title: string, message: string, confirmLabel: string, cancelLabel: string, destructive = false): Promise<boolean> {
  return useConfirmStore.getState().open({ title, message, confirmLabel, cancelLabel, destructive });
}
