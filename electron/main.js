/**
 * Optional Electron desktop shell for packaging Stream Freak as a standalone PC/Mac/Linux app.
 * Uses the static export in `out/` (or loads STREAMFREAK_DESKTOP_URL when set).
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "out");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(OUT_DIR, cleanPath === "/" ? "index.html" : cleanPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (fs.existsSync(filePath + ".html")) filePath += ".html";
        else filePath = path.join(OUT_DIR, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#090a0f",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "public", "icons", "icon-512.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external download links (like Zokoanime/Kwik) in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (process.env.STREAMFREAK_DESKTOP_URL) {
    win.loadURL(process.env.STREAMFREAK_DESKTOP_URL);
  } else {
    const { server, url } = await startStaticServer();
    app.on("before-quit", () => server.close());
    win.loadURL(url);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
