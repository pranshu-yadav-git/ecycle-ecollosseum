import { create } from 'zustand';

export type Device = {
  id: string;
  name: string;
  condition: string;
  aiScore: number;
  verdict: 'KEEP' | 'REPAIR' | 'E-WASTE';
};

type Store = {
  devices: Device[];
  addDevice: (d: Device) => void;
};

export const useDeviceStore = create<Store>((set) => ({
  devices: [],
  addDevice: (d) =>
    set((state) => ({
      devices: [d, ...state.devices],
    })),
}));
