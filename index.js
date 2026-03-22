import express from "express";
import { chromium } from "playwright";
import fs from "fs";
import { exec } from "child_process";

const app = express();
app.use(express.json());

app.post("/render-images", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing required field: url" });
  }

  const framesDir = `./frames_${Date.now()}`;
  fs.mkdirSync(framesDir);

  let browser;

  try {
    browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    console.log("Opening page...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // wait for Cesium to be ready
    await page.waitForFunction(() => window.viewer && window.tileset);

    // wait tiles loaded
    await page.evaluate(() => {
      return window.tileset.readyPromise;
    });

    console.log("Scene ready");

    // 🌞 Force daylight
    await page.evaluate(() => {
      const viewer = window.viewer;
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(
        new Date("2024-06-21T12:00:00Z")
      );
    });

    let count = 0;

    // 🎯 STATIC SHOTS
    const shots = [
      { heading: 0, pitch: -30, range: 2.5 },
      { heading: 90, pitch: -35, range: 2.0 },
      { heading: 180, pitch: -45, range: 1.6 },
      { heading: 270, pitch: -25, range: 2.8 }
    ];

    for (let shot of shots) {
      await page.evaluate((shot) => {
        const viewer = window.viewer;
        const tileset = window.tileset;

        return new Promise((resolve) => {
          viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
            duration: 2,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(shot.heading),
              Cesium.Math.toRadians(shot.pitch),
              tileset.boundingSphere.radius * shot.range
            ),
            complete: resolve
          });
        });
      }, shot);

      await page.waitForTimeout(800);

      const path = `${framesDir}/shot_${count++}.png`;
      await page.screenshot({ path });
    }

    // 🔁 ROTATION SHOTS
    for (let angle = 0; angle < 360; angle += 45) {
      await page.evaluate((angle) => {
        const viewer = window.viewer;
        const tileset = window.tileset;

        return new Promise((resolve) => {
          viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(angle),
              Cesium.Math.toRadians(-35),
              tileset.boundingSphere.radius * 2.2
            ),
            complete: resolve
          });
        });
      }, angle);

      await page.waitForTimeout(500);

      const path = `${framesDir}/rotate_${angle}.png`;
      await page.screenshot({ path });
    }

    // 🔍 ZOOM IN / OUT
    const zoomShots = [
      { heading: 45, pitch: -40, range: 1.2 },
      { heading: 45, pitch: -40, range: 3.5 }
    ];

    for (let shot of zoomShots) {
      await page.evaluate((shot) => {
        const viewer = window.viewer;
        const tileset = window.tileset;

        return new Promise((resolve) => {
          viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
            duration: 2,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(shot.heading),
              Cesium.Math.toRadians(shot.pitch),
              tileset.boundingSphere.radius * shot.range
            ),
            complete: resolve
          });
        });
      }, shot);

      await page.waitForTimeout(800);

      const path = `${framesDir}/zoom_${count++}.png`;
      await page.screenshot({ path });
    }

    // 🗺️ 2D MODE
    await page.evaluate(() => {
      window.viewer.scene.mode = Cesium.SceneMode.SCENE2D;
    });

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${framesDir}/top_view.png`
    });

    await browser.close();

    // 📦 ZIP OUTPUT
    const zipFile = "images.zip";

    exec(`zip -r ${zipFile} ${framesDir}`, (err) => {
      if (err) {
        return res.status(500).json({ error: "Zip failed" });
      }

      res.download(zipFile, () => {
        fs.rmSync(framesDir, { recursive: true, force: true });
        fs.unlinkSync(zipFile);
      });
    });

  } catch (err) {
    console.error(err);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running"));
