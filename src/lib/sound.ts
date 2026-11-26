"use client";

import { useCallback, useSyncExternalStore } from "react";

const SOUND_KEY = "morplan.sound";
const SOUND_EVENT = "morplan:sound";

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedCtx ??= new Ctor();
  if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

function playTone(freqFrom: number, freqTo: number, durationSec: number, gainPeak: number, type: OscillatorType) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(freqTo, now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  } catch {
    // Audio playback is strictly optional tactile polish; ignore browser autoplay blocks.
  }
}

/** Soft tactile click-pop on magnetic course slot drop. */
export function playSnapSound() {
  playTone(420, 660, 0.085, 0.04, "triangle");
}

/** Subtle muted low pulse when a drop causes a schedule or exam clash. */
export function playClashSound() {
  playTone(300, 190, 0.14, 0.045, "sine");
}

/** Soft two-note chime when exporting or sharing a schedule succeeds. */
export function playExportChime() {
  playTone(523.25, 659.25, 0.11, 0.032, "sine");
  setTimeout(() => playTone(659.25, 783.99, 0.13, 0.028, "sine"), 75);
}

function subscribeSound(onChange: () => void) {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSoundSnapshot(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Mute-by-default micro-sound preference persisted in browser storage.
 * Uses `useSyncExternalStore` so SSR starts muted without hydration mismatch or effect setState.
 */
export function useMicroSound(): readonly [boolean, () => void] {
  const enabled = useSyncExternalStore(subscribeSound, getSoundSnapshot, () => false);

  const toggle = useCallback(() => {
    const next = !getSoundSnapshot();
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // Ignore restricted storage contexts.
    }
    window.dispatchEvent(new CustomEvent(SOUND_EVENT));
    if (next) playSnapSound();
  }, []);

  return [enabled, toggle] as const;
}
