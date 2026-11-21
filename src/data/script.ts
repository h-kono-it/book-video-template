// このファイルは config/script.yaml と config/characters.yaml から自動生成される。直接編集しない（npm run sync-script）
import type { BackgroundSpec } from "../components/Background";
import type { TelopSpec, MarkSpec } from "../components/Telop";

export type CharacterId = string;
export type AnimationType = "none" | "fadeIn" | "slideUp" | "slideLeft" | "zoomIn" | "bounce";

export interface VisualContent {
  type: "image" | "text" | "none";
  src?: string;
  text?: string;
  fontSize?: number;
  color?: string;
  animation?: AnimationType;
}
export interface SoundEffect { src: string; volume?: number }
export interface BGMConfig { src: string; volume?: number; loop?: boolean }
export interface CastMember { name: string; position: "left" | "right"; color: string; image: string | null; flipX: boolean }

export interface ScriptLine {
  id: number;
  character: CharacterId;
  text: string;
  displayText?: string;
  scene: number;
  voiceFile: string;
  durationInFrames: number;
  pauseAfter: number;
  emotion?: "normal" | "happy" | "surprised" | "thinking" | "sad";
  visual?: VisualContent;
  se?: SoundEffect;
  bg?: BackgroundSpec;
  telop?: TelopSpec | TelopSpec[];
  marks?: MarkSpec[];
  fx?: ("shake" | "zoom" | "flash" | "lines")[];
}

export interface SceneInfo { id: number; title: string; background: string }
export const scenes: SceneInfo[] = [{ id: 1, title: "main", background: "solid" }];

export const bgmConfig: BGMConfig | null = null;
export const CAST: Record<string, CastMember> = {
  "zundamon": {
    "name": "ずんだもん",
    "position": "right",
    "color": "#228B22",
    "image": "zundamon",
    "flipX": false
  },
  "metan": {
    "name": "四国めたん",
    "position": "left",
    "color": "#FF1493",
    "image": "metan",
    "flipX": true
  }
};
export const scriptData: ScriptLine[] = [
  {
    "id": 1,
    "character": "zundamon",
    "text": "ずんだもんなのだ！",
    "scene": 1,
    "pauseAfter": 15,
    "visual": {
      "type": "text",
      "text": "Remotion × VOICEVOX\nテンプレート",
      "fontSize": 80,
      "color": "#ffffff",
      "animation": "zoomIn"
    },
    "voiceFile": "01_zundamon.wav",
    "durationInFrames": 53
  },
  {
    "id": 2,
    "character": "metan",
    "text": "四国めたんです。",
    "scene": 1,
    "pauseAfter": 15,
    "voiceFile": "02_metan.wav",
    "durationInFrames": 44
  },
  {
    "id": 3,
    "character": "zundamon",
    "text": "このテンプレートで紹介動画が作れるのだ！",
    "scene": 1,
    "pauseAfter": 10,
    "voiceFile": "03_zundamon.wav",
    "durationInFrames": 123
  },
  {
    "id": 4,
    "character": "metan",
    "text": "よろしくね。",
    "scene": 1,
    "pauseAfter": 30,
    "voiceFile": "04_metan.wav",
    "durationInFrames": 31
  }
];
