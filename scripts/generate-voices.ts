/**
 * VOICEVOX で台本の音声を一括生成する
 *   npm run voices            変更のあった行だけ作り直す（テキスト・話者・声パラメータのハッシュで判定）
 *   npm run voices -- --all   全行を作り直す
 *
 * 声 = characters.yaml の speakerId / voice × video-settings.yaml の voice.speed × 行ごとの voice
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  P, readYaml, loadScript, loadCharacters, loadSettings, voiceFileName, resolveVoice,
} from "./lib/project";

const HOST = process.env.VOICEVOX_HOST ?? "http://localhost:50021";

const wavSeconds = (buf: Buffer) => {
  // RIFF を走査して fmt と data チャンクを探す
  let off = 12, byteRate = 0, dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") { dataLen = size; break; }
    off += 8 + size + (size % 2);
  }
  return byteRate ? dataLen / byteRate : 0;
};

async function main() {
  const all = process.argv.includes("--all");
  try {
    const v = await fetch(`${HOST}/version`);
    console.log(`VOICEVOX ${await v.text()}`);
  } catch {
    console.error(`VOICEVOX に接続できない（${HOST}）。アプリを起動して。`);
    process.exit(1);
  }

  const lines = loadScript();
  const chars = loadCharacters();
  const settings = loadSettings();
  const fps = settings.video.fps ?? 30;
  fs.mkdirSync(P.voices, { recursive: true });
  const cache: Record<string, string> = readYaml(P.voiceCache, {});
  const durations: Record<string, number> = readYaml(P.durations, {});
  const used = new Set<string>();
  let made = 0;

  for (const line of lines) {
    const ch = chars[line.character];
    if (!ch || ch.speakerId == null) {
      console.error(`skip #${line.id}: ${line.character} に speakerId が無い`);
      continue;
    }
    const file = voiceFileName(line);
    used.add(file);
    const out = path.join(P.voices, file);
    const v = resolveVoice(line, chars, settings);
    const hash = crypto.createHash("sha1").update(JSON.stringify([line.text, ch.speakerId, v])).digest("hex").slice(0, 12);
    if (!all && cache[file] === hash && fs.existsSync(out) && durations[file]) continue;

    const q = await (await fetch(
      `${HOST}/audio_query?speaker=${ch.speakerId}&text=${encodeURIComponent(line.text)}`, { method: "POST" }
    )).json();
    q.speedScale = v.speed;
    q.pitchScale = v.pitch;
    q.intonationScale = v.intonation;
    q.volumeScale = v.volume;
    const res = await fetch(`${HOST}/synthesis?speaker=${ch.speakerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q),
    });
    if (!res.ok) throw new Error(`synthesis failed #${line.id}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(out, buf);
    const sec = wavSeconds(buf);
    durations[file] = Math.ceil(sec * fps);
    cache[file] = hash;
    made++;
    console.log(`#${line.id} ${line.character} ${sec.toFixed(2)}s  ${line.text.slice(0, 30)}`);
  }

  // 台本から消えた行の wav を掃除
  for (const f of fs.readdirSync(P.voices)) {
    if (f.endsWith(".wav") && !used.has(f)) {
      fs.rmSync(path.join(P.voices, f));
      delete durations[f];
      delete cache[f];
    }
  }
  fs.writeFileSync(P.durations, JSON.stringify(durations, null, 2));
  fs.writeFileSync(P.voiceCache, JSON.stringify(cache, null, 2));
  console.log(`✅ ${made} 行を生成（${lines.length - made} 行は変更なし）`);
}

main();
