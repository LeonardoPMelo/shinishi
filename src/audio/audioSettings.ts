import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AudioBus = 'music' | 'sfx' | 'ambient';

interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  muted: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  ambientMuted: boolean;
  setVolume: (bus: AudioBus | 'master', value: number) => void;
  toggleMute: (bus?: AudioBus) => void;
}

export const useAudioSettings = create<AudioSettings>()(
  persist(
    (set) => ({
      master: 0.85,
      music: 0.55,
      sfx: 0.8,
      ambient: 0.6,
      muted: false,
      musicMuted: false,
      sfxMuted: false,
      ambientMuted: false,
      setVolume: (bus, value) => set({ [bus]: Math.max(0, Math.min(1, value)) } as Partial<AudioSettings>),
      toggleMute: (bus) =>
        set((s) => {
          if (!bus) return { muted: !s.muted };
          const key = `${bus}Muted` as const;
          return { [key]: !s[key] } as Partial<AudioSettings>;
        }),
    }),
    {
      name: 'shinichi-audio',
      partialize: (s) => ({
        master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient,
        muted: s.muted, musicMuted: s.musicMuted, sfxMuted: s.sfxMuted, ambientMuted: s.ambientMuted,
      }),
    }
  )
);
