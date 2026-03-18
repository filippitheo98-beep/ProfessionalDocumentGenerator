const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const LOCAL_URL = "http://127.0.0.1:5000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function isReachable(url) {
  try {
    const res = await fetchWithTimeout(url, 1500);
    return !!res && res.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url)) return true;
    await sleep(400);
  }
  return false;
}

function startLocalServer() {
  const node = process.execPath; // node bundled with Electron
  const entry = path.join(process.resourcesPath, "app.asar", "..", "dist", "index.js");

  // En dev, dist/index.js est dans le workspace
  const devEntry = path.join(process.cwd(), "dist", "index.js");
  const realEntry = require("fs").existsSync(devEntry) ? devEntry : entry;

  const child = spawn(node, [realEntry], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "5000",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  return child;
}

async function createWindow() {
  const remoteUrl = (process.env.DUERP_REMOTE_URL || "").trim();
  const useRemote = remoteUrl && (await isReachable(remoteUrl));

  let serverProcess = null;
  const targetUrl = useRemote ? remoteUrl : LOCAL_URL;

  if (!useRemote) {
    serverProcess = startLocalServer();
    const ok = await waitForUrl(LOCAL_URL, 20_000);
    if (!ok) {
      // fallback: ouvre quand même, l’utilisateur verra l’erreur serveur
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.on("closed", () => {
    if (serverProcess && !serverProcess.killed) serverProcess.kill();
  });

  await win.loadURL(targetUrl);
}

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

