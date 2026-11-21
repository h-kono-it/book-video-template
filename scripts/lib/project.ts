/**
 * 台本・キャスト・設定・ブリーフの読み込みを共通化したもの。
 * 尺の単位はすべて「実時間のフレーム数」（playbackRate は 1.0 前提。テンポは VOICEVOX の話速と pauseScale で調整する）。
 */
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export const ROOT = process.cwd();
export const P = {
  script: path.join(ROOT, "config/script.yaml"),
  characters: path.join(ROOT, "config/characters.yaml"),
  defaults: path.join(ROOT, "config/defaults.yaml"),
  brief: path.join(ROOT, "config/brief.yaml"),
  bgm: path.join(ROOT, "config/bgm.yaml"),
  settings: path.join(ROOT, "video-settings.yaml"),
  voices: path.join(ROOT, "public/voices"),
  durations: path.join(ROOT, "public/voices/durations.json"),
  voiceCache: path.join(ROOT, "public/voices/cache.json"),
};

export const readYaml = <T = any>(p: string, fallback: T): T =>
  fs.existsSync(p) ? ((yaml.parse(fs.readFileSync(p, "utf-8")) as T) ?? fallback) : fallback;

export interface VoiceParams {
  speed?: number;
  pitch?: number;
  intonation?: number;
  volume?: number;
}

export interface CharacterDef {
  name: string;
  speakerId: number | null; // VOICEVOX のスタイル ID
  position: "left" | "right";
  color: string;
  image?: string | null; // public/images/<image>/。null なら立ち絵なし
  flipX?: boolean;
  voice?: VoiceParams;
  defaultPauseAfter?: number;
}

export interface ScriptLineYaml {
  id: number;
  character: string;
  text: string;
  displayText?: string;
  scene?: number;
  pauseAfter?: number;
  voice?: VoiceParams; // 行ごとの声の上書き
  [k: string]: unknown;
}

export interface Settings {
  video: { width: number; height: number; fps: number; playbackRate?: number };
  voice?: { speed?: number; pauseScale?: number };
  [k: string]: any;
}

export const loadScript = () => readYaml<ScriptLineYaml[]>(P.script, []) || [];
export const loadCharacters = () => readYaml<Record<string, CharacterDef>>(P.characters, {});
export const loadSettings = () => readYaml<Settings>(P.settings, { video: { width: 1920, height: 1080, fps: 30 } });
export const loadDefaults = () => readYaml<any>(P.defaults, { newLine: { pauseAfter: 15, durationInFrames: 60, scene: 1 } });
export const loadBrief = () => readYaml<any>(P.brief, {});

export const voiceFileName = (line: { id: number; character: string }) =>
  `${String(line.id).padStart(2, "0")}_${line.character}.wav`;

/** 台本の pauseAfter（未指定ならキャラ→defaults の既定値）に pauseScale を掛けた実フレーム数 */
export const effectivePause = (
  line: ScriptLineYaml,
  chars: Record<string, CharacterDef>,
  defaults: any,
  settings: Settings
) => {
  const base = line.pauseAfter ?? chars[line.character]?.defaultPauseAfter ?? defaults.newLine?.pauseAfter ?? 15;
  return Math.round(base * (settings.voice?.pauseScale ?? 1));
};

/** キャラ × 全体 × 行 の声パラメータを合成する（speed は掛け算、それ以外は後勝ち） */
export const resolveVoice = (line: ScriptLineYaml, chars: Record<string, CharacterDef>, settings: Settings) => {
  const c = chars[line.character]?.voice ?? {};
  const l = line.voice ?? {};
  return {
    speed: (settings.voice?.speed ?? 1) * (c.speed ?? 1) * (l.speed ?? 1),
    pitch: l.pitch ?? c.pitch ?? 0,
    intonation: l.intonation ?? c.intonation ?? 1,
    volume: l.volume ?? c.volume ?? 1,
  };
};
