import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const ffmpeg = require("@ffmpeg-installer/ffmpeg");

const FPS = 60;
const DURATION_SECONDS = 4;
const FRAME_COUNT = FPS * DURATION_SECONDS;
const WIDTH = 1920;
const HEIGHT = 1080;
const GIF_WIDTH = 1280;
const GIF_FPS = 15;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(scriptDir, "logo-sting.html");
const outDir = join(scriptDir, "out");
const framesDir = join(outDir, "frames");
const browserProfileDir = join(outDir, "chromium-profile");
const crashDumpsDir = join(outDir, "chromium-crash-dumps");
const mp4Path = join(outDir, "telora-logo-sting.mp4");
const gifPath = join(outDir, "telora-logo-sting.gif");
const palettePath = join(outDir, "palette.png");
const keepFrames = process.argv.includes("--keep-frames");

let browser;

async function main() {
  try {
    await prepareOutput();

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);

    await loadStingPage(page);
    await captureFrames(page);
    await stitchMp4();
    await stitchGif();
    await rm(palettePath, { force: true });

    if (!keepFrames) {
      await rm(framesDir, { recursive: true, force: true });
    }

    await printOutputSummary();
  } catch (error) {
    console.error(`Render failed: ${formatError(error)}`);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch((error) => {
        console.warn(`Warning: could not close browser cleanly: ${formatError(error)}`);
      });
    }
    if (process.exitCode !== 1) {
      await rm(browserProfileDir, { recursive: true, force: true });
      await rm(crashDumpsDir, { recursive: true, force: true });
    }
  }
}

async function prepareOutput() {
  // Start from a clean frame directory so stale PNGs cannot enter the stitch.
  await mkdir(outDir, { recursive: true });
  await rm(framesDir, { recursive: true, force: true });
  await rm(browserProfileDir, { recursive: true, force: true });
  await rm(crashDumpsDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(browserProfileDir, { recursive: true });
  await mkdir(crashDumpsDir, { recursive: true });
  await rm(mp4Path, { force: true });
  await rm(gifPath, { force: true });
  await rm(palettePath, { force: true });
}

async function launchBrowser() {
  try {
    console.log("Launching bundled Chromium...");
    return await puppeteer.launch({
      headless: true,
      defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
      userDataDir: browserProfileDir,
      args: [
        `--crash-dumps-dir=${crashDumpsDir}`,
        "--disable-breakpad",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-crash-reporter",
        "--disable-renderer-backgrounding"
      ]
    });
  } catch (error) {
    throw new Error(`Could not launch bundled Chromium. ${formatError(error)}`);
  }
}

async function loadStingPage(page) {
  const fontFailures = new Set();
  const isGoogleFontRequest = (url) => url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com");

  page.on("requestfailed", (request) => {
    if (isGoogleFontRequest(request.url())) {
      const failure = request.failure();
      fontFailures.add(`${request.url()}${failure?.errorText ? ` (${failure.errorText})` : ""}`);
    }
  });

  page.on("response", (response) => {
    if (isGoogleFontRequest(response.url()) && !response.ok()) {
      fontFailures.add(`${response.url()} (${response.status()} ${response.statusText()})`);
    }
  });

  try {
    const pageUrl = pathToFileURL(htmlPath);
    pageUrl.searchParams.set("clean", "1");

    console.log(`Loading ${pageUrl.href}`);
    await page.goto(pageUrl.href, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Let the font face set settle before the first deterministic frame.
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (fontFailures.size > 0) {
      console.warn("Warning: Google Fonts failed to load; the render will use the fallback font.");
      for (const failure of fontFailures) {
        console.warn(`  ${failure}`);
      }
    }

    const canvasSize = await page.$eval(".canvas", (element) => ({
      width: element.clientWidth,
      height: element.clientHeight
    }));
    if (canvasSize.width !== WIDTH || canvasSize.height !== HEIGHT) {
      throw new Error(`Canvas is ${canvasSize.width}x${canvasSize.height}; expected ${WIDTH}x${HEIGHT}.`);
    }
  } catch (error) {
    throw new Error(`Could not load logo sting page. ${formatError(error)}`);
  }
}

async function captureFrames(page) {
  try {
    // Pause registered CSS animations so every screenshot is driven by currentTime.
    const animationCount = await page.evaluate(() => {
      const animations = document.getAnimations();
      animations.forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      return animations.length;
    });

    if (animationCount !== 3) {
      throw new Error(`Expected exactly 3 animations, but found ${animationCount}.`);
    }

    console.log(`Capturing ${FRAME_COUNT} PNG frames at ${WIDTH}x${HEIGHT}, ${FPS}fps...`);
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      const currentTimeMs = (frame / FPS) * 1000;
      await page.evaluate((time) => {
        document.getAnimations().forEach((animation) => {
          animation.currentTime = time;
        });
      }, currentTimeMs);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      await page.screenshot({
        path: join(framesDir, `frame-${String(frame).padStart(4, "0")}.png`),
        type: "png",
        captureBeyondViewport: false
      });
    }
  } catch (error) {
    throw new Error(`Could not capture deterministic frames. ${formatError(error)}`);
  }
}

async function stitchMp4() {
  console.log("Stitching MP4...");
  await runFfmpeg(
    [
      "-y",
      "-hide_banner",
      "-framerate",
      String(FPS),
      "-start_number",
      "0",
      "-i",
      join(framesDir, "frame-%04d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "18",
      "-r",
      String(FPS),
      "-movflags",
      "+faststart",
      mp4Path
    ],
    "MP4 stitch"
  );
}

async function stitchGif() {
  console.log("Building GIF palette...");
  await runFfmpeg(
    [
      "-y",
      "-hide_banner",
      "-framerate",
      String(FPS),
      "-start_number",
      "0",
      "-i",
      join(framesDir, "frame-%04d.png"),
      "-vf",
      `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      palettePath
    ],
    "GIF palette generation"
  );

  console.log("Stitching GIF...");
  await runFfmpeg(
    [
      "-y",
      "-hide_banner",
      "-framerate",
      String(FPS),
      "-start_number",
      "0",
      "-i",
      join(framesDir, "frame-%04d.png"),
      "-i",
      palettePath,
      "-lavfi",
      `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`,
      gifPath
    ],
    "GIF stitch"
  );
}

async function printOutputSummary() {
  const outputs = [mp4Path, gifPath];
  console.log("Render complete.");
  for (const outputPath of outputs) {
    const fileStat = await stat(outputPath);
    const media = await probeMedia(outputPath);
    const details = [
      `path=${outputPath}`,
      `size=${formatBytes(fileStat.size)}`,
      `duration=${media.duration ?? "unknown"}`,
      media.dimensions ? `dimensions=${media.dimensions}` : null
    ].filter(Boolean);
    console.log(details.join(" | "));
  }

  if (keepFrames) {
    const frames = await readdir(framesDir);
    console.log(`Frames kept in ${framesDir} (${frames.length} files).`);
  }
}

async function probeMedia(filePath) {
  const result = await runFfmpeg(["-hide_banner", "-i", filePath], `probe ${filePath}`, { allowFailure: true });
  const probeOutput = `${result.stdout}\n${result.stderr}`;
  const durationMatch = probeOutput.match(/Duration:\s*([0-9:.]+)/);
  const dimensionsMatch = probeOutput.match(/Video:.*?,\s*(\d{2,5}x\d{2,5})[\s,]/);
  return {
    duration: durationMatch?.[1],
    dimensions: dimensionsMatch?.[1]
  };
}

function runFfmpeg(args, label, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg.path, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(new Error(`${label} could not start. ${formatError(error)}`));
    });

    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}.\n${stderr || stdout}`));
    });
  });
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]} (${bytes} bytes)`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

main();
