import { create } from 'zustand';
import { BluetoothStateManager, ThermalPrinter } from '@finan-me/react-native-thermal-printer';
import { kvGet, kvSet } from '@/lib/db';
import { requestBluetoothPermissions } from '@/features/printer/permissions';
import type { ReceiptNode } from '@/features/receipts/render';

export interface PrinterDevice {
  name: string;
  address: string;
}

type Status = 'disconnected' | 'connecting' | 'connected';

interface PrinterState {
  status: Status;
  device: PrinterDevice | null;
  bluetoothOn: boolean;
  permission: boolean | null;
  scanning: boolean;
  printing: boolean;
  paired: PrinterDevice[];
  found: PrinterDevice[];
  lastError: string | null;
  init: () => void;
  scan: () => Promise<void>;
  connect: (device: PrinterDevice) => Promise<boolean>;
  disconnect: () => Promise<void>;
  forget: () => Promise<void>;
  print: (nodes: ReceiptNode[], paperWidthMm: number) => Promise<void>;
  enableBluetooth: () => Promise<void>;
}

const KV_KEY = 'printer_device';
let initialized = false;

function btAddress(mac: string) {
  return mac.startsWith('bt:') ? mac : `bt:${mac}`;
}

function errorMessage(e: unknown) {
  const err = e as { message?: string; suggestion?: string };
  return [err?.message, err?.suggestion].filter(Boolean).join(' ') || 'Unknown printer error';
}

export const usePrinterStore = create<PrinterState>((set, getState) => ({
  status: 'disconnected',
  device: null,
  bluetoothOn: true,
  permission: null,
  scanning: false,
  printing: false,
  paired: [],
  found: [],
  lastError: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const saved = kvGet(KV_KEY);
    if (saved) {
      try {
        set({ device: JSON.parse(saved) as PrinterDevice });
      } catch {
        kvSet(KV_KEY, null);
      }
    }
    BluetoothStateManager.getState()
      .then((s) => set({ bluetoothOn: s === 'PoweredOn' }))
      .catch(() => undefined);
    BluetoothStateManager.onStateChange((s) => {
      const on = s === 'PoweredOn';
      set({ bluetoothOn: on });
      if (!on) set({ status: 'disconnected' });
    });
    ThermalPrinter.addConnectionEventListener('EVENT_CONNECTION_STATE_CHANGED', ({ address, state }) => {
      const current = getState().device;
      if (!current || btAddress(current.address) !== address) return;
      set({ status: state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected' });
    });
    // Verify the saved printer in the background so the indicator is truthful on launch.
    if (saved) void getState().connect(JSON.parse(saved) as PrinterDevice);
  },

  enableBluetooth: async () => {
    try {
      await BluetoothStateManager.enable();
      set({ bluetoothOn: true });
    } catch (e) {
      set({ lastError: errorMessage(e) });
    }
  },

  scan: async () => {
    const ok = await requestBluetoothPermissions();
    set({ permission: ok });
    if (!ok) return;
    set({ scanning: true, lastError: null });
    try {
      const { paired, found } = await ThermalPrinter.scanDevices();
      const map = (d: { name?: string; address: string }) => ({ name: d.name || d.address, address: d.address.replace(/^(bt|ble):/, '') });
      set({ paired: (paired ?? []).map(map), found: (found ?? []).filter((d) => d.deviceType !== 'ble').map(map) });
    } catch (e) {
      set({ lastError: errorMessage(e) });
    } finally {
      set({ scanning: false });
    }
  },

  connect: async (device) => {
    const ok = await requestBluetoothPermissions();
    set({ permission: ok });
    if (!ok) return false;
    set({ status: 'connecting', lastError: null });
    try {
      const result = await ThermalPrinter.testConnection(btAddress(device.address));
      if (!result.success) throw new Error(result.error?.message ?? 'Connection failed');
      kvSet(KV_KEY, JSON.stringify(device));
      set({ device, status: 'connected' });
      return true;
    } catch (e) {
      set({ status: 'disconnected', lastError: errorMessage(e) });
      return false;
    }
  },

  disconnect: async () => {
    try {
      await ThermalPrinter.disconnectAll();
    } catch {
      // ignore
    }
    set({ status: 'disconnected' });
  },

  forget: async () => {
    await getState().disconnect();
    kvSet(KV_KEY, null);
    set({ device: null });
  },

  print: async (nodes, paperWidthMm) => {
    const device = getState().device;
    if (!device) throw new Error('No printer selected');
    set({ printing: true, lastError: null });
    try {
      const result = await ThermalPrinter.printReceipt({
        printers: [{ address: btAddress(device.address), options: { paperWidthMm, encoding: 'utf8', marginMm: 1, keepAlive: true } }],
        documents: [nodes as never],
      });
      if (!result.success) {
        const first = result.results.values().next().value;
        throw new Error(first?.error?.message ?? 'Print failed');
      }
      set({ status: 'connected' });
    } catch (e) {
      set({ status: 'disconnected', lastError: errorMessage(e) });
      throw e;
    } finally {
      set({ printing: false });
    }
  },
}));
