import { AbsoluteFill, useCurrentFrame, useVideoConfig, Audio, Sequence, staticFile, Loop } from "remotion";
import { loadFont } from "@remotion/google-fonts/MPLUSRounded1c";
import { scriptData, scenes, ScriptLine, bgmConfig, CAST } from "./data/script";
import { SETTINGS } from "./settings.generated";
import { COLORS, VIDEO_CONFIG } from "./config";
import { Subtitle } from "./components/Subtitle";
import { Character } from "./components/Character";
import { SceneVisuals } from "./components/SceneVisuals";
import { Background, BackgroundSegment } from "./components/Background";
import { TelopLayer, TelopSpec, MarkSpec } from "./components/Telop";

// Google Fontsをロード
const { fontFamily } = loadFont();

// 再生速度を考慮したフレーム数を計算
const getAdjustedFrames = (frames: number): number =>
  Math.ceil(frames / VIDEO_CONFIG.playbackRate);

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 現在のセリフを計算
  let accumulatedFrames = 0;
  let currentLine: ScriptLine | null = null;
  let currentLineStartFrame = 0;
  let currentScene = 1;
  let isSpeaking = false;

  for (const line of scriptData) {
    const adjustedDuration = getAdjustedFrames(line.durationInFrames);
    const adjustedPause = getAdjustedFrames(line.pauseAfter);
    const lineEndFrame = accumulatedFrames + adjustedDuration + adjustedPause;

    if (frame >= accumulatedFrames && frame < lineEndFrame) {
      currentLine = line;
      currentLineStartFrame = accumulatedFrames;
      currentScene = line.scene;
      // 音声再生中は adjustedDuration の間だけ
      isSpeaking = frame < accumulatedFrames + adjustedDuration;
      break;
    }
    accumulatedFrames = lineEndFrame;
    currentScene = line.scene;
  }

  const sceneInfo = scenes.find((s) => s.id === currentScene) || scenes[0];

  // 各セリフの開始フレームを計算
  const getLineStartFrame = (index: number): number => {
    let startFrame = 0;
    for (let i = 0; i < index; i++) {
      startFrame +=
        getAdjustedFrames(scriptData[i].durationInFrames) +
        getAdjustedFrames(scriptData[i].pauseAfter);
    }
    return startFrame;
  };

  // 各セリフの再生速度調整済み長さを取得
  const getLineDuration = (line: ScriptLine): number =>
    getAdjustedFrames(line.durationInFrames);

  // 背景セグメント（bg 指定から次の bg 指定まで継続）
  const totalLen = getLineStartFrame(scriptData.length);
  const bgSegments: BackgroundSegment[] = [];
  scriptData.forEach((line, index) => {
    if (!line.bg) return;
    const from = getLineStartFrame(index);
    const prev = bgSegments[bgSegments.length - 1];
    if (prev) prev.duration = from - prev.from;
    bgSegments.push({ spec: line.bg, from, duration: totalLen - from + 60 });
  });

  // テロップ・強調枠のセグメント:
  // 連続する行に「まったく同じ内容」の項目があれば1つにつなげ、行が変わってもアニメーションをやり直さない
  type OverlaySeg = { key: string; from: number; duration: number; telop?: TelopSpec; mark?: MarkSpec };
  const overlaySegs: OverlaySeg[] = [];
  const openSegs = new Map<string, OverlaySeg>();
  scriptData.forEach((line, index) => {
    const from = getLineStartFrame(index);
    const len = getLineDuration(line) + getAdjustedFrames(line.pauseAfter);
    const telops = line.telop ? (Array.isArray(line.telop) ? line.telop : [line.telop]) : [];
    const items: [string, { telop?: TelopSpec; mark?: MarkSpec }][] = [
      ...telops.map((t) => [`t:${JSON.stringify(t)}`, { telop: t }] as [string, { telop: TelopSpec }]),
      ...(line.marks ?? []).map((m) => [`m:${JSON.stringify(m)}`, { mark: m }] as [string, { mark: MarkSpec }]),
    ];
    for (const [k, item] of items) {
      const open = openSegs.get(k);
      if (open && open.from + open.duration === from) {
        open.duration += len; // 直前の行から続いている → 延長
      } else {
        const seg = { key: `${k}@${from}`, from, duration: len, ...item };
        overlaySegs.push(seg);
        openSegs.set(k, seg);
      }
    }
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: `${fontFamily}, 'Noto Sans JP', 'Hiragino Sans', sans-serif`,
      }}
    >
      {/* 黒板背景 */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 60,
          right: 60,
          bottom: 160,
          background: COLORS.blackboard,
          borderRadius: 8,
        }}
      />
      {/* 黒板の茶色フチ（下部） */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 160,
          height: 24,
          background: COLORS.blackboardBorder,
          borderRadius: "0 0 8px 8px",
        }}
      />
      {/* 全面背景（Playwright録画 / スクショ / ページ画像） */}
      <Background segments={bgSegments} fps={fps} />

      {/* BGM再生 */}
      {bgmConfig && (
        <Audio
          src={staticFile(`bgm/${bgmConfig.src}`)}
          volume={bgmConfig.volume ?? 0.3}
          loop={bgmConfig.loop ?? true}
        />
      )}

      {/* 音声再生 */}
      {scriptData.map((line, index) => {
        const startFrame = getLineStartFrame(index);
        return (
          <Sequence
            key={`audio-${line.id}`}
            from={startFrame}
            durationInFrames={getLineDuration(line)}
            premountFor={fps}
          >
            <Audio
              src={staticFile(`voices/${line.voiceFile}`)}
              playbackRate={VIDEO_CONFIG.playbackRate}
            />
            {/* 効果音再生 */}
            {line.se && (
              <Audio
                src={staticFile(`se/${line.se.src}`)}
                volume={line.se.volume ?? 1}
              />
            )}
          </Sequence>
        );
      })}

      {/* シーンごとのビジュアル */}
      <SceneVisuals
        scene={currentScene}
        lineId={currentLine?.id ?? null}
        frame={frame}
        fps={fps}
        visual={currentLine?.visual}
      />

      {/* テロップ・強調枠（同じ内容が連続する行はつなげて1回だけアニメーション） */}
      {overlaySegs.map((seg) => (
        <Sequence key={seg.key} from={seg.from} durationInFrames={Math.max(1, seg.duration)}>
          <TelopLayer telop={seg.telop} marks={seg.mark ? [seg.mark] : undefined} />
        </Sequence>
      ))}

      {/* キャラクター（台本に登場するキャストだけ） */}
      {[...new Set(scriptData.map((l) => l.character))]
        .filter((id) => CAST[id])
        .map((id) => (
          <Character
            key={`char-${id}`}
            characterId={id}
            isSpeaking={isSpeaking && currentLine?.character === id}
            emotion={currentLine?.character === id ? currentLine.emotion : "normal"}
          />
        ))}

      {/* 字幕 */}
      {currentLine && (SETTINGS.subtitle as { enabled?: boolean }).enabled !== false && (
        <Sequence
          key={`subtitle-${currentLine.id}`}
          from={currentLineStartFrame}
          durationInFrames={getLineDuration(currentLine)}
        >
          <Subtitle
            text={currentLine.displayText ?? currentLine.text}
            character={currentLine.character}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
