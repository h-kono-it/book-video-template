import { Composition } from "remotion";
import { Main } from "./Main";
import { scriptData } from "./data/script";
import { VIDEO_CONFIG } from "./config";

// 動画の総フレーム数を計算
const calculateTotalFrames = () => {
  // Main.tsx と同じく playbackRate を考慮した長さで合計する
  const adj = (f: number) => Math.ceil(f / VIDEO_CONFIG.playbackRate);
  let total = 0;
  for (const line of scriptData) {
    total += adj(line.durationInFrames) + adj(line.pauseAfter);
  }
  total += 30; // エンディング用の余白
  return total;
};

export const RemotionRoot: React.FC = () => {
  const totalFrames = calculateTotalFrames();

  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={totalFrames}
        fps={VIDEO_CONFIG.fps}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />
    </>
  );
};
