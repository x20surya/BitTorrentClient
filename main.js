import { app, BrowserWindow, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { ipcMain } from "electron";
import * as torrent from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("choose-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
  });

  return result.filePaths[0];
});

ipcMain.handle("start-torrent", (event, filePath, destPath) => {
  const openedTorrent = torrent.open(filePath);
  torrent.download(openedTorrent, openedTorrent.info.name, destPath);
});

ipcMain.handle("choose-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  return result.filePaths[0];
});
