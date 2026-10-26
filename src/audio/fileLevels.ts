/**
 * Playback gain for each licensed file in public/assets/audio, so a recorded sound sits at the same
 * loudness as the synthesized one it replaced (the packs are mastered much louder than the game mix).
 *
 * Measured, not guessed: each value is (RMS of the synthesized sound) ÷ (RMS of the file), both over
 * the audible part, capped so the file's peak never exceeds 1.25× the synthesized peak. Music uses
 * the synthesized village track's level (RMS ≈ 0.056). When a file is swapped, measure it again
 * (see docs/REFORMULACAO.md §22); a name missing here plays at gain 1.
 */
export const FILE_GAIN: Record<string, number> = {
  // Kenney "Impact Sounds" / "RPG Audio" / "Interface Sounds" / "Music Jingles" (CC0)
  'sfx:step_grass': 0.05,
  'sfx:step_stone': 0.069,
  'sfx:step_wood': 0.109,
  'sfx:land': 0.351,
  'sfx:jump': 0.112,
  'sfx:coin': 0.577,
  'sfx:item': 0.316,
  'sfx:gem': 0.098,
  'sfx:ring': 0.206,
  'sfx:chime': 0.082,
  'sfx:chest': 0.181,
  'sfx:mechanism': 0.061,
  'sfx:temple_bell': 0.539,
  'sfx:target_hit': 0.283,
  'sfx:thwack': 0.192,
  'sfx:kick': 0.456,
  'sfx:flop': 0.131,
  'sfx:ui_open': 0.118,
  'sfx:ui_close': 0.097,
  'sfx:ui_select': 0.139,
  'sfx:blip': 0.05,
  'sfx:challenge_correct': 0.2, // RMS match gave 0.133; raised so the "right answer" peak is closer to the old one
  'sfx:challenge_wrong': 0.186,
  'sfx:denied': 0.16,
  'sfx:wish': 0.099,
  // OpenGameArt (CC0)
  'music:village': 0.442,
  'music:menu': 0.146,
  'music:comic': 0.24,
  'music:puzzle': 0.21,
  'music:forest': 0.423,
  'music:training': 0.371, // Bamboo Blitz, converted from FLAC to Opus (webm) in the browser
  // quiet by nature (mystery and ambience): measured 1.37 and 1.13, kept at 1 so they sit a bit under the village
  'music:investigation': 1,
  'music:secret': 1,
  'music:emotional': 0.65, // measured 0.761; a little softer, it plays under sad conversations
  'music:festival': 0.259,
};
