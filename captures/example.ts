import type { Scenario } from "../scripts/capture";

// 収録シナリオのサンプル: npm run capture -- captures/example.ts
export const options = { width: 1920, height: 1080, record: true };

const run: Scenario = async ({ page, shot, mark, pause }) => {
  await page.goto("https://example.com");
  await mark("top");
  await pause(1200);
  await shot("top");
  await page.mouse.move(960, 400, { steps: 25 });
  await mark("hover-link");
  await page.getByRole("link").first().hover();
  await pause(1500);
};
export default run;
