// Voice read-out hook.
//
// Naturalness knobs:
//   • Model: OpenAI `tts-1-hd` (higher fidelity than `tts-1`).
//   • Voice: `nova` for all languages — the warmest OpenAI voice and the
//     one that handles Indian names / Hindi / Telugu tokens best.
//   • Speed: per-language preset (0.9-0.95). If the text contains
//     Devanagari or Telugu script we drop the speed to 0.88 automatically
//     so the pronunciation is more comfortable for outdoor listening.
//
// Playback:
//   • Web → HTMLAudioElement (reliable across browsers, no expo shim quirks).
//   • Native → expo-audio AudioPlayer.
// Both paths are wrapped in a promise so `speakQueue` can chain multiple
// utterances end-to-end (used by "Read all crops" on the Crops tab).
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { api, getBaseUrl } from "./api";
import { Lang } from "./i18n";

type Preset = { voice: string; speed: number; model: string };

const VOICE_PRESETS: Record<Lang, Preset> = {
  en: { voice: "nova", speed: 0.95, model: "tts-1-hd" },
  te: { voice: "nova", speed: 0.9,  model: "tts-1-hd" },
  hi: { voice: "nova", speed: 0.9,  model: "tts-1-hd" },
};

export function detectScript(text: string): "devanagari" | "telugu" | "latin" {
  if (/[\u0900-\u097F]/.test(text)) return "devanagari";
  if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
  return "latin";
}

export function resolveSpeed(text: string, lang: Lang | null): number {
  const preset = VOICE_PRESETS[(lang ?? "en") as Lang];
  const script = detectScript(text);
  // Auto-slow for Devanagari / Telugu content regardless of the UI language,
  // capped by the preset (never faster than the language default).
  if (script !== "latin") return Math.min(preset.speed, 0.88);
  return preset.speed;
}

export function voicePreset(lang: Lang | null): Preset {
  return VOICE_PRESETS[(lang ?? "en") as Lang];
}

let audioModeReady: Promise<any> | null = null;
function ensureAudioMode() {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true, shouldPlayInBackground: false,
    }).catch(() => {});
  }
  return audioModeReady;
}

let nativePlayer: AudioPlayer | null = null;
let webAudio: HTMLAudioElement | null = null;

function stopAll() {
  try { nativePlayer?.pause(); } catch {}
  try { if (webAudio) { webAudio.pause(); webAudio.currentTime = 0; } } catch {}
  if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
}

function speakWebNative(text: string, lang: Lang | null): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const langMap: Record<Lang, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };
      u.lang = langMap[lang ?? "en"] || "en-US";
      u.rate = resolveSpeed(text, lang);
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

function playUrl(fullUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Platform.OS === "web") {
      stopAll();
      const el = new Audio(fullUrl);
      webAudio = el;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.onended = () => resolve();
      el.onerror = (e) => reject(new Error("audio error: " + e));
      el.play().then(() => {/* started */}).catch((err) => reject(err));
    } else {
      try { nativePlayer?.remove(); } catch {}
      const p = createAudioPlayer({ uri: fullUrl });
      nativePlayer = p;
      p.addListener("playbackStatusUpdate", (s: any) => {
        if (s.didJustFinish) resolve();
      });
      try { p.play(); } catch (err) { reject(err); }
    }
  });
}

async function fetchAndPlay(text: string, lang: Lang | null): Promise<void> {
  try {
    const preset = voicePreset(lang);
    const speed = resolveSpeed(text, lang);
    const { url } = await api.tts(text, preset.voice, speed, preset.model);
    const fullUrl = url.startsWith("http")
      ? url
      : `${getBaseUrl()}${url}`;
    await playUrl(fullUrl);
  } catch (err) {
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      console.info("[voice] backend TTS audio failed or blocked, using browser speech:", err);
      await speakWebNative(text, lang);
    } else {
      throw err;
    }
  }
}

export function useVoiceRead() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [queuePos, setQueuePos] = useState<{ i: number; n: number } | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    ensureAudioMode();
    return () => {
      activeRef.current = false;
      stopAll();
    };
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    stopAll();
    setState("idle");
    setQueuePos(null);
  }, []);

  const speak = useCallback(async (text: string, lang: Lang | null = "en") => {
    if (state === "playing" || state === "loading") { stop(); return; }
    setState("loading");
    activeRef.current = true;
    await ensureAudioMode();
    try {
      setState("playing");
      await fetchAndPlay(text, lang);
      if (activeRef.current) setState("idle");
    } catch (err) {
      console.warn("[voice] speak failed:", err);
      setState("error");
    }
  }, [state, stop]);

  const speakQueue = useCallback(async (items: string[], lang: Lang | null = "en") => {
    if (state !== "idle") { stop(); return; }
    if (!items.length) return;
    activeRef.current = true;
    setState("loading");
    await ensureAudioMode();
    for (let i = 0; i < items.length; i++) {
      if (!activeRef.current) break;
      setQueuePos({ i: i + 1, n: items.length });
      try {
        setState("playing");
        await fetchAndPlay(items[i], lang);
      } catch (err) {
        console.warn("[voice] queue item failed:", err);
        setState("error");
        setQueuePos(null);
        return;
      }
    }
    if (activeRef.current) {
      setState("idle");
      setQueuePos(null);
    }
  }, [state, stop]);

  return { state, speak, speakQueue, stop, queuePos };
}
