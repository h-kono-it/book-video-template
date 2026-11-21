/**
 * config/brief.yaml の「技術的なパラメータ」を各設定ファイルに反映する
 *   npm run apply-brief
 *
 * 反映先:
 *   tempo     → video-settings.yaml の voice.speed / voice.pauseScale
 *   aspect    → video-settings.yaml の video.width/height、キャラと字幕のサイズ
 *   subtitles → video-settings.yaml の subtitle.enabled
 *   cast      → config/characters.yaml（話者・スタイル・声・立ち位置）
 *   bgm       → config/bgm.yaml
 * length / kind / audience / tone などの内容面のパラメータは、台本を書くときに Claude が参照する（ここでは触らない）
 */
import * as fs from "fs";
import * as yaml from "yaml";
import { execSync } from "child_process";
import { P, loadBrief } from "./lib/project";

const HOST = process.env.VOICEVOX_HOST ?? "http://localhost:50021";

const TEMPO: Record<string, { speed: number; pauseScale: number }> = {
  slow: { speed: 1.0, pauseScale: 1.4 },
  normal: { speed: 1.15, pauseScale: 1.0 },
  fast: { speed: 1.3, pauseScale: 0.6 },
};

// subBottom: 字幕の下端。縦型・正方形ではキャラの上に字幕を逃がす
const ASPECT: Record<string, { width: number; height: number; charHeight: number; subWidth: number; fontSize: number; subBottom: number }> = {
  landscape: { width: 1920, height: 1080, charHeight: 275, subWidth: 55, fontSize: 70, subBottom: 40 },
  portrait: { width: 1080, height: 1920, charHeight: 240, subWidth: 90, fontSize: 64, subBottom: 260 },
  square: { width: 1080, height: 1080, charHeight: 200, subWidth: 80, fontSize: 56, subBottom: 210 },
};

// 同梱の立ち絵があるキャラの既定値
const KNOWN: Record<string, { name: string; speaker: string; color: string; flipX?: boolean; defaultId: number }> = {
  zundamon: { name: "ずんだもん", speaker: "ずんだもん", color: "#228B22", defaultId: 3 },
  metan: { name: "四国めたん", speaker: "四国めたん", color: "#FF1493", flipX: true, defaultId: 2 },
};

type CastEntry =
  | string
  | { id: string; name?: string; speaker?: string; style?: string; speakerId?: number; voice?: any; image?: string | null; color?: string; flipX?: boolean };

let speakersCache: any[] | null = null;
async function resolveStyleId(speaker: string, style = "ノーマル"): Promise<number> {
  if (!speakersCache) {
    try {
      speakersCache = await (await fetch(`${HOST}/speakers`)).json();
    } catch {
      throw new Error(`話者「${speaker}」のスタイル ID を調べるには VOICEVOX の起動が必要（または cast に speakerId を直接書く）`);
    }
  }
  const sp = speakersCache!.find((s) => s.name === speaker);
  if (!sp) throw new Error(`VOICEVOX に話者「${speaker}」がいない。候補: ${speakersCache!.map((s) => s.name).join(", ")}`);
  const st = sp.styles.find((s: any) => s.name === style);
  if (!st) throw new Error(`「${speaker}」にスタイル「${style}」がない。候補: ${sp.styles.map((s: any) => s.name).join(", ")}`);
  return st.id;
}

async function main() {
  const brief = loadBrief();
  const settings = yaml.parseDocument(fs.readFileSync(P.settings, "utf-8"));
  const charsDoc = yaml.parseDocument(fs.readFileSync(P.characters, "utf-8"));
  const log: string[] = [];

  // tempo
  if (brief.tempo != null) {
    const t = typeof brief.tempo === "string" ? TEMPO[brief.tempo] : { ...TEMPO.normal, ...brief.tempo };
    if (!t) throw new Error(`tempo は slow / normal / fast か { speed, pauseScale }: ${brief.tempo}`);
    settings.setIn(["voice", "speed"], t.speed);
    settings.setIn(["voice", "pauseScale"], t.pauseScale);
    settings.setIn(["video", "playbackRate"], 1.0);
    log.push(`tempo: 話速 ${t.speed} / 間 x${t.pauseScale}`);
  }

  // aspect
  if (brief.aspect) {
    const a = ASPECT[brief.aspect];
    if (!a) throw new Error(`aspect は landscape / portrait / square: ${brief.aspect}`);
    settings.setIn(["video", "width"], a.width);
    settings.setIn(["video", "height"], a.height);
    settings.setIn(["character", "height"], a.charHeight);
    settings.setIn(["subtitle", "maxWidthPercent"], a.subWidth);
    settings.setIn(["font", "size"], a.fontSize);
    settings.setIn(["subtitle", "bottomOffset"], a.subBottom);
    log.push(`aspect: ${brief.aspect} ${a.width}x${a.height}`);
  }

  if (brief.subtitles != null) {
    settings.setIn(["subtitle", "enabled"], !!brief.subtitles);
    log.push(`subtitles: ${!!brief.subtitles}`);
  }

  // cast（先頭が説明役＝右、2人目が聞き役＝左）
  if (Array.isArray(brief.cast) && brief.cast.length) {
    const current = (charsDoc.toJS() ?? {}) as Record<string, any>;
    const positions = ["right", "left"];
    for (const [i, raw] of (brief.cast as CastEntry[]).entries()) {
      const e = typeof raw === "string" ? { id: raw } : raw;
      const known = KNOWN[e.id];
      const prev = current[e.id] ?? {};
      const speaker = e.speaker ?? known?.speaker ?? prev.name;
      // brief が正本: 書いていない項目は既定値に戻す（前回の style や voice を引きずらない）
      let speakerId = e.speakerId ?? known?.defaultId ?? prev.speakerId;
      if (e.speakerId == null && (e.speaker || e.style)) speakerId = await resolveStyleId(speaker, e.style);
      if (speakerId == null) throw new Error(`${e.id}: speakerId が決まらない（speaker/style か speakerId を書く）`);
      const def = {
        name: e.name ?? prev.name ?? known?.name ?? speaker,
        speakerId,
        position: positions[i % 2],
        color: e.color ?? prev.color ?? known?.color ?? "#3b82f6",
        image: e.image !== undefined ? e.image : prev.image !== undefined ? prev.image : known ? e.id : null,
        flipX: e.flipX ?? prev.flipX ?? (positions[i % 2] === "left" ? !!known?.flipX : false),
        voice: e.voice ?? {},
        defaultPauseAfter: prev.defaultPauseAfter ?? 15,
      };
      charsDoc.set(e.id, charsDoc.createNode(def));
      log.push(`cast[${i}]: ${e.id} = ${speaker}${e.style ? `（${e.style}）` : ""} id=${speakerId} ${def.position}${def.image ? "" : " 立ち絵なし"}`);
    }
  }

  // bgm
  if (brief.bgm !== undefined) {
    if (!brief.bgm || brief.bgm === "off") {
      fs.rmSync(P.bgm, { force: true });
      log.push("bgm: off");
    } else {
      const b = typeof brief.bgm === "string" ? { src: brief.bgm } : brief.bgm;
      fs.writeFileSync(P.bgm, yaml.stringify({ volume: 0.15, loop: true, ...b }));
      log.push(`bgm: ${b.src}`);
    }
  }

  fs.writeFileSync(P.settings, String(settings));
  fs.writeFileSync(P.characters, String(charsDoc));
  console.log(log.map((l) => `  ${l}`).join("\n") || "  反映する項目なし");
  // 反映し忘れで古い設定のまま描画されないよう、ここで生成ファイルまで更新する
  execSync("npm run --silent sync-settings && npm run --silent sync-script", { stdio: "ignore" });
  console.log("✅ brief を反映して sync 済み。声（cast / tempo）を変えたなら npm run voices も実行する");
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
