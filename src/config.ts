// 動画設定
import { SETTINGS } from "./settings.generated";

// 動画設定（video-settings.yaml → settings.generated.ts）
const V = SETTINGS.video as { width: number; height: number; fps: number; playbackRate?: number };
export const VIDEO_CONFIG = {
  width: V.width,
  height: V.height,
  fps: V.fps,
  playbackRate: V.playbackRate ?? 1.0, // テンポは VOICEVOX の話速で調整するので通常 1.0
};

// カラーパレット（黒板風デザイン）
export const COLORS = {
  background: "#ffffff",      // 外側の白背景
  blackboard: "#2d5a3d",      // 黒板の緑
  blackboardBorder: "#8B4513", // 黒板の茶色フチ
  text: "#ffffff",            // 白文字
  textMuted: "#e0e0e0",
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  pink: "#ec4899",
  zundamon: "#228B22",        // フォレストグリーン（暗め）
  metan: "#FF1493",           // ディープピンク
};

// キャラクター定義
export type CharacterId = string; // キャストは config/characters.yaml で定義（src/data/script.ts の CAST）

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  voicevoxSpeakerId: number;
  position: "left" | "right";
  color: string;
  // 画像設定（口パクアニメーション用）
  images: {
    mouthOpen: string; // 口開き画像パス
    mouthClose: string; // 口閉じ画像パス
  };
  flipX?: boolean; // 画像を左右反転するか
}

// デフォルトキャラクター設定
// めたん: 左下、ずんだもん: 右下
export const DEFAULT_CHARACTERS: CharacterConfig[] = [
  {
    id: "metan",
    name: "四国めたん",
    voicevoxSpeakerId: 2,
    position: "left",
    color: COLORS.metan,
    images: {
      mouthOpen: "images/metan/mouth_open.png",
      mouthClose: "images/metan/mouth_close.png",
    },
    flipX: true, // 元画像が左向きなので右向きに反転
  },
  {
    id: "zundamon",
    name: "ずんだもん",
    voicevoxSpeakerId: 3,
    position: "right",
    color: COLORS.zundamon,
    images: {
      mouthOpen: "images/zundamon/mouth_open.png",
      mouthClose: "images/zundamon/mouth_close.png",
    },
    flipX: false,
  },
];

// キャラクターIDからspeakerIdを取得するマップ
export const characterSpeakerMap: Record<CharacterId, number> = {
  zundamon: 3,
  metan: 2,
};

// シーン背景タイプ
export type BackgroundType = "gradient" | "solid" | "image";

export interface SceneConfig {
  id: number;
  title: string;
  background: BackgroundType;
  backgroundColor?: string;
  backgroundImage?: string;
}

// VOICEVOX設定
export const VOICEVOX_CONFIG = {
  host: "http://localhost:50021",
  defaultSpeedScale: 1.0,
  defaultPitchScale: 0.0,
  defaultIntonationScale: 1.0,
  defaultVolumeScale: 1.0,
};
