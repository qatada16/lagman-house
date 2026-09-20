import { create } from 'zustand';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  resolve: ((value: boolean) => void) | null;
  open: (req: ConfirmRequest) => Promise<boolean>;
  close: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, getState) => ({
  request: null,
  resolve: null,
  open: (req) =>
    new Promise<boolean>((resolve) => {
      getState().resolve?.(false);
      set({ request: req, resolve });
    }),
  close: (value) => {
    getState().resolve?.(value);
    set({ request: null, resolve: null });
  },
}));
