import { create } from 'zustand';
import type { EmitterSubscription } from 'react-native';
import { BluetoothStateManager, ThermalPrinter } from '@finan-me/react-native-thermal-printer';
import { kvGet, kvSet } from '@/lib/db';
import { requestBluetoothPermissions } from '@/features/printer/permissions';
import { parseDevice, parseDeviceList, printerScore, type ScannedDevice } from '@/features/printer/detect';
import type { ReceiptNode } from '@/features/receipts/render';

export interface PrinterDevice {
  name: string;
  address: string;
}

export interface LastConnected extends PrinterDevice {
  at: string;
}

type Status = 'disconnected' | 'connecting' | 'connected';

interface PrinterState {
  status: Status;
  device: PrinterDevice | null;
  lastConnected: LastConnected | null;
  bluetoothOn: boolean;
  permission: boolean | null;
  scanning: boolean;
  printing: boolean;
  connectingAddress: string | null;
  devices: ScannedDevice[];
  lastError: string | null;
  init: () => void;
  scan: () => Promise<void>;
  stopScan: () => void;
  connect: (device: PrinterDevice) => Promise<boolean>;
  disconnect: () => Promise<void>;
  forget: () => Promise<void>;
  print: (nodes: ReceiptNode[], paperWidthMm: number) => Promise<void>;
  enableBluetooth: () => Promise<void>;
}

const KV_DEVICE = 'printer_device';
const KV_LAST = 'printer_last_connected';
const SCAN_TIMEOUT_MS = 15000;
const ESC_INIT = [0x1b, 0x40];

let initialized = false;
let scanSubs: EmitterSubscription[] = [];
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function btAddress(mac: string) {
  return mac.startsWith('bt:') ? mac : `bt:${mac}`;
}

function errorMessage(e: unknown) {
  const err = e as { message?: string; suggestion?: string };
  return [err?.message, err?.suggestion].filter(Boolean).join(' ') || 'Unknown printer error';
}

function readJson<T>(key: string): T | null {
  const raw = kvGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    kvSet(key, null);
    return null;
  }
}

function sortDevices(list: ScannedDevice[], lastAddress: string | null) {
  return [...list].sort((a, b) => {
    if (a.address === lastAddress) return -1;
    if (b.address === lastAddress) return 1;
    if (a.paired !== b.paired) return a.paired ? -1 : 1;
    return printerScore(b) - printerScore(a) || a.name.localeCompare(b.name);
  });
}

function clearScanListeners() {
  for (const s of scanSubs) s.remove();
  scanSubs = [];
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
}

// Opens (or reuses) a persistent socket by sending ESC @, which resets the printer without printing anything.
async function openSocket(address: string) {
  const result = await ThermalPrinter.NativePrinter.printRaw(btAddress(address), ESC_INIT, { keepAlive: true, timeout: 15000 });
  if (!result.success) throw new Error(result.error?.message ?? 'Could not connect to the printer');
}

export const usePrinterStore = create<PrinterState>((set, getState) => ({
  status: 'disconnected',
  device: null,
  lastConnected: null,
  bluetoothOn: true,
  permission: null,
  scanning: false,
  printing: false,
  connectingAddress: null,
  devices: [],
  lastError: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const device = readJson<PrinterDevice>(KV_DEVICE);
    set({ device, lastConnected: readJson<LastConnected>(KV_LAST) });
    BluetoothStateManager.getState()
      .then((s) => set({ bluetoothOn: s === 'PoweredOn' }))
      .catch(() => undefined);
    BluetoothStateManager.onStateChange((s) => {
      const on = s === 'PoweredOn';
      set({ bluetoothOn: on });
      if (!on) set({ status: 'disconnected' });
    });
    if (device) void getState().connect(device);
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
    clearScanListeners();
    set({ scanning: true, lastError: null, devices: [] });
    const lastAddress = getState().lastConnected?.address ?? null;

    const merge = (incoming: ScannedDevice[]) => {
      const byAddress = new Map(getState().devices.map((d) => [d.address, d]));
      for (const d of incoming) {
        const prev = byAddress.get(d.address);
        byAddress.set(d.address, prev ? { ...prev, ...d, paired: prev.paired || d.paired } : d);
      }
      set({ devices: sortDevices([...byAddress.values()], lastAddress) });
    };
    const finish = () => {
      clearScanListeners();
      set({ scanning: false });
    };

    scanSubs = [
      ThermalPrinter.addDiscoveryEventListener('EVENT_DEVICE_ALREADY_PAIRED', (e) => merge(parseDeviceList(e?.devices, true))),
      ThermalPrinter.addDiscoveryEventListener('EVENT_DEVICE_FOUND', (e) => {
        const d = parseDevice(e?.device);
        if (d && d.deviceType !== 'ble') merge([d]);
      }),
      ThermalPrinter.addDiscoveryEventListener('EVENT_DEVICE_DISCOVER_DONE', (e) => {
        merge(parseDeviceList(e?.paired, true));
        merge(parseDeviceList(e?.found, false).filter((d) => d.deviceType !== 'ble'));
        finish();
      }),
      ThermalPrinter.addDiscoveryEventListener('EVENT_BLUETOOTH_NOT_SUPPORT', () => {
        set({ lastError: 'Bluetooth is not supported on this device' });
        finish();
      }),
    ];
    scanTimer = setTimeout(() => {
      void ThermalPrinter.stopScanDevices();
      finish();
    }, SCAN_TIMEOUT_MS);

    try {
      const result = (await ThermalPrinter.scanDevices()) as unknown as { success?: boolean; error?: string };
      if (result && result.success === false && getState().devices.length === 0) {
        set({ lastError: result.error ?? null });
      }
      if (result && result.success === false) finish();
    } catch (e) {
      set({ lastError: errorMessage(e) });
      finish();
    }
  },

  stopScan: () => {
    void ThermalPrinter.stopScanDevices();
    clearScanListeners();
    set({ scanning: false });
  },

  connect: async (device) => {
    const ok = await requestBluetoothPermissions();
    set({ permission: ok });
    if (!ok) return false;
    if (getState().scanning) getState().stopScan();
    const current = getState().device;
    if (current && current.address !== device.address) {
      try {
        await ThermalPrinter.disconnect(btAddress(current.address));
      } catch {
        // previous socket may already be closed
      }
    }
    set({ status: 'connecting', connectingAddress: device.address, lastError: null, device });
    try {
      await openSocket(device.address);
      const last: LastConnected = { ...device, at: new Date().toISOString() };
      kvSet(KV_DEVICE, JSON.stringify(device));
      kvSet(KV_LAST, JSON.stringify(last));
      set({ status: 'connected', lastConnected: last });
      return true;
    } catch (e) {
      set({ status: 'disconnected', lastError: errorMessage(e) });
      return false;
    } finally {
      set({ connectingAddress: null });
    }
  },

  disconnect: async () => {
    try {
      await ThermalPrinter.disconnectAll();
    } catch {
      // nothing to close
    }
    set({ status: 'disconnected' });
  },

  forget: async () => {
    await getState().disconnect();
    kvSet(KV_DEVICE, null);
    set({ device: null });
  },

  print: async (nodes, paperWidthMm) => {
    const device = getState().device;
    if (!device) throw new Error('No printer selected');
    set({ printing: true, lastError: null });
    try {
      const result = await ThermalPrinter.printReceipt({
        printers: [{ address: btAddress(device.address), options: { paperWidthMm, encoding: 'ascii', marginMm: 1, keepAlive: true } }],
        documents: [nodes as never],
      });
      if (!result.success) {
        const first = result.results.values().next().value;
        throw new Error(first?.error?.message ?? 'Print failed');
      }
      const last: LastConnected = { ...device, at: new Date().toISOString() };
      kvSet(KV_LAST, JSON.stringify(last));
      set({ status: 'connected', lastConnected: last });
    } catch (e) {
      set({ status: 'disconnected', lastError: errorMessage(e) });
      throw e;
    } finally {
      set({ printing: false });
    }
  },
}));
