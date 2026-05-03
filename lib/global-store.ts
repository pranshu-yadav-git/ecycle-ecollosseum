/**
 * global-store.ts
 * Single source of truth shared across Home, Community (Scanner), and Market screens.
 * Place this at: lib/global-store.ts  (or wherever your device-store currently lives)
 *
 * Usage:
 *   import { useGlobalStore } from '@/lib/global-store';
 *   const { devices, pickups, ecoPoints, addDevice, addPickup, addEcoPoints, purchaseDevice } = useGlobalStore();
 */

import { create } from 'zustand';

// ─── Point rules ──────────────────────────────────────────────────────────────
export const ECO_POINTS = {
  DEVICE_REGISTERED: 50,          // scanned & added to Your Devices
  PICKUP_STANDARD: 100,           // pickup scheduled for a normal device
  PICKUP_EWASTE: 200,             // pickup for flagged e-waste device
  PICKUP_OLD_DEVICE: 150,         // device older than 5 years gets extra bonus
  REFURBISHED_PURCHASE: 120,      // buying a refurbished item from market
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type DeviceSource = 'scan' | 'market' | 'manual';
export type DeviceType = 'phone' | 'laptop' | 'tv' | 'appliance' | 'accessory' | 'generic';

export interface DeviceEntry {
  id: string;
  name: string;
  type: DeviceType;
  condition: string;           // e.g. "Good", free-form from scan answers
  isEwaste: boolean;
  source: DeviceSource;
  addedAt: number;             // Date.now()
  yearManufactured?: number;   // used to detect >5yr old devices
  pickupScheduled?: boolean;
  pickupDate?: string;
  pickupTime?: string;
  pickupAddress?: string;
  verdict?: 'KEEP' | 'REPAIR' | 'RECYCLE';
  aiScore?: number;
  // market extras
  emoji?: string;
  priceINR?: number;
}

export interface PickupEntry {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  isEwaste: boolean;
  address: string;
  date: string;
  time: string;
  extraImages: string[];
  scheduledAt: number;         // Date.now()
}

export interface EcoPointEvent {
  id: string;
  reason: string;
  points: number;
  at: number;
}

interface GlobalStore {
  // ── State ────────────────────────────────────────────────────────────────
  devices: DeviceEntry[];
  pickups: PickupEntry[];
  ecoPoints: number;
  pointHistory: EcoPointEvent[];

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Add a scanned or manually added device. Awards registration points. */
  addDevice: (device: Omit<DeviceEntry, 'id' | 'addedAt'>) => string; // returns id

  /** Remove a device by id */
  removeDevice: (id: string) => void;

  /** Update pickup flag on a device */
  markDevicePickupScheduled: (deviceId: string, date: string, time: string, address: string) => void;

  /** Add a pickup entry. Awards points based on ewaste/age. */
  addPickup: (pickup: Omit<PickupEntry, 'id' | 'scheduledAt'>) => void;

  /** Cancel a pickup */
  cancelPickup: (id: string) => void;

  /** Add a purchased market item as a device */
  purchaseDevice: (item: { name: string; emoji: string; priceINR: number; category: string }) => void;

  /** Manually add eco points (e.g. for community events) */
  addEcoPoints: (amount: number, reason: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
let _idCounter = 1;
const uid = () => `dev_${Date.now()}_${_idCounter++}`;

const isOlderThan5Years = (device: Omit<DeviceEntry, 'id' | 'addedAt'>) => {
  if (device.yearManufactured) {
    return new Date().getFullYear() - device.yearManufactured >= 5;
  }
  return false;
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useGlobalStore = create<GlobalStore>((set, get) => ({
  // Pre-seed with "This Phone" as the default device
  devices: [
    {
      id: 'default_phone',
      name: 'This Phone',
      type: 'phone',
      condition: 'Good',
      isEwaste: false,
      source: 'manual',
      addedAt: Date.now(),
      verdict: 'KEEP',
      aiScore: 85,
      emoji: '📱',
      pickupScheduled: false,
    },
  ],
  pickups: [],
  ecoPoints: 0,
  pointHistory: [],

  addDevice: (device) => {
    const id = uid();
    const newDevice: DeviceEntry = { ...device, id, addedAt: Date.now() };
    const pts = ECO_POINTS.DEVICE_REGISTERED;

    set((s) => ({
      devices: [newDevice, ...s.devices],
      ecoPoints: s.ecoPoints + pts,
      pointHistory: [
        { id: uid(), reason: `Device registered: ${device.name}`, points: pts, at: Date.now() },
        ...s.pointHistory,
      ],
    }));

    return id;
  },

  removeDevice: (id) => {
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
  },

  markDevicePickupScheduled: (deviceId, date, time, address) => {
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === deviceId
          ? { ...d, pickupScheduled: true, pickupDate: date, pickupTime: time, pickupAddress: address }
          : d
      ),
    }));
  },

  addPickup: (pickup) => {
    const id = uid();
    const newPickup: PickupEntry = { ...pickup, id, scheduledAt: Date.now() };

    // Calculate points
    const device = get().devices.find((d) => d.id === pickup.deviceId);
    let pts = pickup.isEwaste ? ECO_POINTS.PICKUP_EWASTE : ECO_POINTS.PICKUP_STANDARD;
    let reason = `Pickup scheduled: ${pickup.deviceName}`;

    if (device && isOlderThan5Years(device)) {
      pts += ECO_POINTS.PICKUP_OLD_DEVICE;
      reason += ' (5yr+ bonus)';
    }

    // Mark device
    get().markDevicePickupScheduled(pickup.deviceId, pickup.date, pickup.time, pickup.address);

    set((s) => ({
      pickups: [newPickup, ...s.pickups],
      ecoPoints: s.ecoPoints + pts,
      pointHistory: [
        { id: uid(), reason, points: pts, at: Date.now() },
        ...s.pointHistory,
      ],
    }));
  },

  cancelPickup: (id) => {
    const pickup = get().pickups.find((p) => p.id === id);
    if (pickup) {
      set((s) => ({
        pickups: s.pickups.filter((p) => p.id !== id),
        devices: s.devices.map((d) =>
          d.id === pickup.deviceId
            ? { ...d, pickupScheduled: false, pickupDate: undefined, pickupTime: undefined, pickupAddress: undefined }
            : d
        ),
      }));
    }
  },

  purchaseDevice: (item) => {
    const id = uid();
    const newDevice: DeviceEntry = {
      id,
      name: item.name,
      type: (item.category?.toLowerCase() as DeviceType) || 'generic',
      condition: 'Refurbished',
      isEwaste: false,
      source: 'market',
      addedAt: Date.now(),
      verdict: 'KEEP',
      aiScore: 90,
      emoji: item.emoji,
      priceINR: item.priceINR,
      pickupScheduled: false,
    };

    const pts = ECO_POINTS.REFURBISHED_PURCHASE;

    set((s) => ({
      devices: [newDevice, ...s.devices],
      ecoPoints: s.ecoPoints + pts,
      pointHistory: [
        {
          id: uid(),
          reason: `Refurbished purchase: ${item.name}`,
          points: pts,
          at: Date.now(),
        },
        ...s.pointHistory,
      ],
    }));
  },

  addEcoPoints: (amount, reason) => {
    set((s) => ({
      ecoPoints: s.ecoPoints + amount,
      pointHistory: [
        { id: uid(), reason, points: amount, at: Date.now() },
        ...s.pointHistory,
      ],
    }));
  },
}));
