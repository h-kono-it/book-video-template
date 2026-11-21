/**
 * config/script.yaml + config/characters.yaml → src/data/script.ts を生成する
 *   npm run sync-script
 */
import * as fs from "fs";
import * as path from "path";
import {
  P, ROOT, readYaml, loadScript, loadCharacters, loadDefaults, loadSettings,
  voiceFileName, effectivePause,
} from "./lib/project";

const OUTPUT = path.join(ROOT, "src/data/script.ts");

function main() {
  const lines = loadScript();
  const chars = loadCharacters();
  const defaults = loadDefaults();
  const settings = loadSettings();
  const durations: Record<string, number> = readYaml(P.durations, {});
  const bgm = readYaml<any>(P.bgm, null);

  const unknown = [...new Set(lines.map((l) => l.character))].filter((c) => !chars[c]);
  if (unknown.length) console.warn(`⚠️  characters.yaml に無いキャラ: ${unknown.join(", ")}`);

  const processed = lines.map((line) => {
    const voiceFile = voiceFileName(line);
    const { voice, ...rest } = line;
    return {
      ...rest,
      scene: line.scene ?? defaults.newLine?.scene ?? 1,
      voiceFile,
      durationInFrames: durations[voiceFile] ?? defaults.newLine?.durationInFrames ?? 60,
      pauseAfter: effectivePause(line, chars, defaults, settings),
    };
  });

  const cast = Object.fromEntries(
    Object.entries(chars).map(([id, c]) => [
      id,
      { name: c.name, position: c.position, color: c.color, image: c.image === undefined ? id : c.image, flipX: !!c.flipX },
    ])
  );

  const ts = `// このファイルは config/script.yaml と config/characters.yaml から自動生成される。直接編集しない（npm run sync-script）
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

export const bgmConfig: BGMConfig | null = ${JSON.stringify(bgm)};
export const CAST: Record<string, CastMember> = ${JSON.stringify(cast, null, 2)};
export const scriptData: ScriptLine[] = ${JSON.stringify(processed, null, 2)};
`;
  fs.writeFileSync(OUTPUT, ts);
  console.log(`✅ src/data/script.ts を生成（${processed.length} 行）`);
}

main();
