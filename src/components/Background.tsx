import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame } from "remotion";

/**
 * 全面背景レイヤー。
 * script.yaml の行に `bg` を書くと、その行から「次に bg が指定される行」まで表示され続ける。
 *   - image: スクショ紙芝居 / 本のページ画像（kenBurns でゆっくりズーム）
 *   - video: Playwright 録画など（startFrom 秒から再生。セリフをまたいで連続再生される）
 *   - color: 単色
 *   - none : 背景を消して元の黒板デザインに戻す
 */
export interface BackgroundSpec {
  type: "image" | "video" | "color" | "none";
  src?: string; // public/content/ からの相対パス
  fit?: "contain" | "cover";
  color?: string; // color 用、または contain 時の余白色
  kenBurns?: "in" | "out" | "none";
  startFrom?: number; // video: 開始位置（秒）
  playbackRate?: number; // video: 再生速度
  volume?: number; // video: 音量（既定 0 = ミュート）
}

export interface BackgroundSegment {
  spec: BackgroundSpec;
  from: number;
  duration: number;
}

const ImageBg: React.FC<{ spec: BackgroundSpec; duration: number }> = ({ spec, duration }) => {
  const frame = useCurrentFrame();
  const kb = spec.kenBurns ?? "none";
  const scale =
    kb === "in"
      ? interpolate(frame, [0, duration], [1, 1.08])
      : kb === "out"
        ? interpolate(frame, [0, duration], [1.08, 1])
        : 1;
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: spec.color ?? "#111", opacity }}>
      <Img
        src={staticFile(`content/${spec.src}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: spec.fit ?? "contain",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Background: React.FC<{ segments: BackgroundSegment[]; fps: number }> = ({ segments, fps }) => (
  <>
    {segments.map((seg, i) => {
      const { spec } = seg;
      if (spec.type === "none") return null;
      return (
        <Sequence key={`bg-${i}`} from={seg.from} durationInFrames={Math.max(1, seg.duration)} premountFor={fps}>
          {spec.type === "color" && <AbsoluteFill style={{ background: spec.color ?? "#111" }} />}
          {spec.type === "image" && spec.src && <ImageBg spec={spec} duration={seg.duration} />}
          {spec.type === "video" && spec.src && (
            <AbsoluteFill style={{ background: spec.color ?? "#111" }}>
              <OffthreadVideo
                src={staticFile(`content/${spec.src}`)}
                startFrom={Math.round((spec.startFrom ?? 0) * fps)}
                playbackRate={spec.playbackRate ?? 1}
                volume={spec.volume ?? 0}
                style={{ width: "100%", height: "100%", objectFit: spec.fit ?? "contain" }}
              />
            </AbsoluteFill>
          )}
        </Sequence>
      );
    })}
  </>
);
