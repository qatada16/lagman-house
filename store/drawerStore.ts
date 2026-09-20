import { create } from 'zustand';

interface DrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useDrawerStore = create<DrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
