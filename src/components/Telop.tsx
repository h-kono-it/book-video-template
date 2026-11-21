import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SETTINGS } from "../settings.generated";

// 字幕（下端 bottomOffset、2行で約 200px）より上に置く
const ABOVE_SUBTITLE = (SETTINGS.subtitle.bottomOffset ?? 40) + 260;

/**
 * 文字入れ（テロップ）と強調枠。セリフ1行の間だけ表示される。
 *
 * telop:
 *   text: "第3章 Java 21"      # 改行は \n
 *   style: label | title | emphasis | note
 *   position: top-left | top | top-right | center | bottom   (省略時は style ごとの既定)
 *   accent: "#ffcc00"          # 帯やラベルの色
 * marks:                       # 画面に対する % 座標の強調枠
 *   - { x: 10, y: 20, w: 30, h: 8, label: "ここ" }
 */
export interface TelopSpec {
  text: string;
  style?: "label" | "title" | "emphasis" | "note" | "impact";
  position?: "top-left" | "top" | "top-right" | "center" | "bottom";
  accent?: string;
  fontSize?: number;
  rotate?: number; // impact の傾き（度）。既定 -4
}

export interface MarkSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  color?: string;
}

const DEFAULT_POS: Record<NonNullable<TelopSpec["style"]>, NonNullable<TelopSpec["position"]>> = {
  label: "top-left",
  title: "top",
  emphasis: "center",
  note: "top-right",
  impact: "center",
};

const posStyle = (pos: NonNullable<TelopSpec["position"]>): React.CSSProperties => {
  switch (pos) {
    case "top-left":
      return { top: 48, left: 56, alignItems: "flex-start" };
    case "top-right":
      return { top: 48, right: 56, alignItems: "flex-end" };
    case "top":
      return { top: 48, left: 0, right: 0, alignItems: "center" };
    case "center":
      return { top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" };
    case "bottom":
      return { bottom: ABOVE_SUBTITLE, left: 0, right: 0, alignItems: "center" };
  }
};

const TelopBox: React.FC<{ t: TelopSpec }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = t.style ?? "label";
  const accent = t.accent ?? "#ffcc00";
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const fade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });

  let inner: React.CSSProperties;
  switch (style) {
    case "title":
      inner = {
        fontSize: t.fontSize ?? 76,
        fontWeight: 900,
        color: "#fff",
        background: "rgba(10,12,20,0.82)",
        borderLeft: `14px solid ${accent}`,
        padding: "18px 44px",
        borderRadius: 10,
        transform: `translateY(${(1 - enter) * -30}px)`,
      };
      break;
    case "emphasis":
      inner = {
        fontSize: t.fontSize ?? 120,
        fontWeight: 900,
        color: "#fff",
        WebkitTextStroke: `16px ${accent}`,
        paintOrder: "stroke fill",
        textAlign: "center",
        transform: `scale(${0.6 + 0.4 * enter})`,
      };
      break;
    case "impact": {
      // ドパガキ用: 大きく出て弾みながら縮む・傾き・黄色の極太文字に黒縁と色付きの影
      const pop = spring({ frame, fps, config: { damping: 7, stiffness: 260, mass: 0.6 } });
      inner = {
        fontSize: t.fontSize ?? 150,
        fontWeight: 900,
        color: "#ffe600",
        WebkitTextStroke: `20px #111`,
        paintOrder: "stroke fill",
        textShadow: `12px 12px 0 ${t.accent ?? "#ff2d55"}`,
        textAlign: "center",
        letterSpacing: "-0.02em",
        transform: `rotate(${t.rotate ?? -4}deg) scale(${interpolate(pop, [0, 1], [2.2, 1])})`,
      };
      break;
    }
    case "note":
      inner = {
        fontSize: t.fontSize ?? 40,
        fontWeight: 700,
        color: "#111",
        background: "rgba(255,255,255,0.92)",
        border: `4px solid ${accent}`,
        padding: "10px 22px",
        borderRadius: 10,
      };
      break;
    default: // label
      inner = {
        fontSize: t.fontSize ?? 44,
        fontWeight: 900,
        color: "#111",
        background: accent,
        padding: "8px 26px",
        borderRadius: 999,
        transform: `translateX(${(1 - enter) * -40}px)`,
      };
  }

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        opacity: fade,
        ...posStyle(t.position ?? DEFAULT_POS[style]),
      }}
    >
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.3, ...inner }}>{t.text}</div>
    </div>
  );
};

const Mark: React.FC<{ m: MarkSpec }> = ({ m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const color = m.color ?? "#ff3b30";
  return (
    <div
      style={{
        position: "absolute",
        left: `${m.x}%`,
        top: `${m.y}%`,
        width: `${m.w}%`,
        height: `${m.h}%`,
        border: `8px solid ${color}`,
        borderRadius: 14,
        boxShadow: "0 0 0 4px rgba(255,255,255,0.7)",
        transform: `scale(${1.15 - 0.15 * s})`,
        opacity: Math.min(1, s * 1.5),
      }}
    >
      {m.label && (
        <div
          style={{
            position: "absolute",
            top: -64,
            left: -8,
            background: color,
            color: "#fff",
            fontSize: 36,
            fontWeight: 900,
            padding: "4px 18px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          {m.label}
        </div>
      )}
    </div>
  );
};

export const TelopLayer: React.FC<{ telop?: TelopSpec | TelopSpec[]; marks?: MarkSpec[] }> = ({ telop, marks }) => {
  const telops = telop ? (Array.isArray(telop) ? telop : [telop]) : [];
  return (
    <AbsoluteFill>
      {(marks ?? []).map((m, i) => (
        <Mark key={`m-${i}`} m={m} />
      ))}
      {telops.map((t, i) => (
        <TelopBox key={`t-${i}`} t={t} />
      ))}
    </AbsoluteFill>
  );
};
