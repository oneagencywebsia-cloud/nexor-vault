'use client';

import { create } from 'zustand';

interface VaultState {
  email: string | null;
  vaultKey: Uint8Array | null; // SOLO en memoria, nunca persistido ni enviado al server
  unlocked: boolean;
  setUnlocked: (email: string, vaultKey: Uint8Array) => void;
  lock: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  email: null,
  vaultKey: null,
  unlocked: false,
  setUnlocked: (email, vaultKey) => set({ email, vaultKey, unlocked: true }),
  lock: () => set({ vaultKey: null, unlocked: false }),
}));
