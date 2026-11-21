/**
 * Playwright で Web 画面を録画 / スクショする。
 *
 *   npm run capture -- captures/demo.ts
 *
 * シナリオファイル（captures/*.ts）は default export で async 関数を返す:
 *
 *   import type { Scenario } from "../scripts/capture";
 *   const run: Scenario = async ({ page, shot, mark, pause }) => {
 *     await page.goto("http://localhost:5173");
 *     await mark("top");               // 録画上の秒数を記録 → bg.startFrom に使う
 *     await page.getByRole("button", { name: "ログイン" }).click();
 *     await shot("after-login");       // public/content/shots/<name>/after-login.png
 *     await pause(1500);
 *   };
 *   export default run;
 *   export const options = { width: 1920, height: 1080, record: true };
 *
 * 出力:
 *   public/content/rec/<name>.webm        録画（record: true のとき）
 *   public/content/rec/<name>.marks.json  mark() のラベル → 秒数
 *   public/content/shots/<name>/*.png     shot() のスクショ
 */
import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

export interface ScenarioContext {
  page: Page;
  shot: (label: string) => Promise<void>;
  mark: (label: string) => Promise<void>;
  pause: (ms: number) => Promise<void>;
}
export type Scenario = (ctx: ScenarioContext) => Promise<void>;
export interface ScenarioOptions {
  width?: number;
  height?: number;
  record?: boolean;
  deviceScaleFactor?: number;
  colorScheme?: "light" | "dark";
}

// 録画にはマウスカーソルが映らないので、疑似カーソルを描く
const FAKE_CURSOR = `
(() => {
  const install = () => {
    if (document.getElementById('__cap_cursor')) return;
    const c = document.createElement('div');
    c.id = '__cap_cursor';
    Object.assign(c.style, {position:'fixed',left:'0',top:'0',width:'28px',height:'28px',marginLeft:'-14px',marginTop:'-14px',
      borderRadius:'50%',background:'rgba(255,59,48,.35)',border:'3px solid rgba(255,59,48,.9)',
      pointerEvents:'none',zIndex:'2147483647',transition:'transform .08s, left .05s, top .05s'});
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX+'px'; c.style.top = e.clientY+'px'; }, true);
    addEventListener('mousedown', () => c.style.transform = 'scale(.7)', true);
    addEventListener('mouseup', () => c.style.transform = 'scale(1)', true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install); else install();
})();`;

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: npm run capture -- captures/<name>.ts");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const name = path.basename(abs).replace(/\.[jt]s$/, "");
  const mod = await import(pathToFileURL(abs).href);
  const run: Scenario = mod.default;
  const opt: ScenarioOptions = { width: 1920, height: 1080, record: true, ...(mod.options ?? {}) };

  const root = process.cwd();
  const recDir = path.join(root, "public/content/rec");
  const shotDir = path.join(root, "public/content/shots", name);
  fs.mkdirSync(recDir, { recursive: true });
  fs.mkdirSync(shotDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(recDir, ".tmp-"));

  const browser = await chromium.launch();
  const size = { width: opt.width!, height: opt.height! };
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: opt.deviceScaleFactor ?? 1,
    colorScheme: opt.colorScheme,
    recordVideo: opt.record ? { dir: tmpDir, size } : undefined,
  });
  const t0 = Date.now();
  await context.addInitScript(FAKE_CURSOR);
  const page = await context.newPage();

  const marks: Record<string, number> = {};
  const ctx: ScenarioContext = {
    page,
    pause: (ms) => page.waitForTimeout(ms),
    mark: async (label) => {
      marks[label] = Math.round((Date.now() - t0) / 100) / 10;
      console.log(`⏱  ${label}: ${marks[label]}s`);
    },
    shot: async (label) => {
      const out = path.join(shotDir, `${label}.png`);
      await page.screenshot({ path: out });
      console.log(`📸 ${path.relative(root, out)}`);
    },
  };

  try {
    await run(ctx);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (video) {
      const out = path.join(recDir, `${name}.webm`);
      fs.renameSync(await video.path(), out);
      fs.writeFileSync(path.join(recDir, `${name}.marks.json`), JSON.stringify(marks, null, 2));
      console.log(`🎬 ${path.relative(root, out)}  (marks: rec/${name}.marks.json)`);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (require.main === module || process.argv[1]?.endsWith("capture.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
