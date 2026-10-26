import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Options only a parent/guardian should change. Personal touches (name, birthday art)
 * stay off unless explicitly enabled here.
 */
interface FamilySettings {
  childName: string;
  birthdayArt: boolean;
  setChildName: (name: string) => void;
  setBirthdayArt: (on: boolean) => void;
}

export const useFamilySettings = create<FamilySettings>()(
  persist(
    (set) => ({
      childName: '',
      birthdayArt: false,
      setChildName: (childName) => set({ childName: childName.slice(0, 24) }),
      setBirthdayArt: (birthdayArt) => set({ birthdayArt }),
    }),
    { name: 'shinichi-family' }
  )
);
