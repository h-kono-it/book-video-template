/**
 * 台本の尺を集計し、brief.yaml の length（目標秒数）と比べる
 *   npm run duration
 * 音声が未生成の行は文字数から見積もる（≈ 7 文字/秒 × 話速）。見積もりの行には * を付ける。
 */
import {
  P, readYaml, loadScript, loadCharacters, loadDefaults, loadSettings, loadBrief,
  voiceFileName, effectivePause, resolveVoice,
} from "./lib/project";

const CHARS_PER_SEC = 7;
const MAX_CHARS = 40;

function main() {
  const lines = loadScript();
  const chars = loadCharacters();
  const defaults = loadDefaults();
  const settings = loadSettings();
  const brief = loadBrief();
  const fps = settings.video.fps ?? 30;
  const durations: Record<string, number> = readYaml(P.durations, {});
  const cache: Record<string, string> = readYaml(P.voiceCache, {});

  let total = 0, estimated = 0;
  const byScene = new Map<number, number>();
  const long: string[] = [];
  let cursor = 0;
  const rows: string[] = [];

  for (const line of lines) {
    const file = voiceFileName(line);
    const len = (line.displayText ?? line.text).length;
    let speech = durations[file] && cache[file] ? durations[file] : 0;
    const est = !speech;
    if (est) {
      speech = Math.ceil((line.text.replace(/\s/g, "").length / (CHARS_PER_SEC * resolveVoice(line, chars, settings).speed)) * fps);
      estimated++;
    }
    const f = speech + effectivePause(line, chars, defaults, settings);
    rows.push(`  #${String(line.id).padStart(3)} ${(cursor / fps).toFixed(1).padStart(6)}s  frame ${String(cursor).padStart(5)}${est ? " *" : "  "} ${line.character.padEnd(9)} ${line.text.slice(0, 24)}`);
    cursor += f;
    total += f;
    const sc = Number(line.scene ?? 1);
    byScene.set(sc, (byScene.get(sc) ?? 0) + f);
    if (len > MAX_CHARS) long.push(`#${line.id}（${len}文字）`);
  }

  const sec = total / fps;
  console.log(`行の開始位置（still で確認するときのフレーム番号）:\n${rows.join("\n")}\n`);
  console.log(`シーン別: ${[...byScene].map(([s, f]) => `S${s}=${(f / fps).toFixed(1)}s`).join("  ")}`);
  console.log(`合計: ${sec.toFixed(1)} 秒（${lines.length} 行${estimated ? `、うち ${estimated} 行は見積もり` : ""}）`);
  if (brief.length) {
    const diff = sec - brief.length;
    const tol = Math.max(3, brief.length * 0.1);
    console.log(`目標: ${brief.length} 秒 → ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} 秒 ${Math.abs(diff) <= tol ? "✅ 許容範囲（±10%）" : diff > 0 ? "⚠️ 長い：行を削るか tempo を上げる" : "⚠️ 短い：行を足すか tempo を下げる"}`);
  }
  if (long.length) console.log(`字幕が長い行（${MAX_CHARS}文字超）: ${long.join(", ")}`);
}

main();
