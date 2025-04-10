import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  chooseSavePath: () => ipcRenderer.invoke("choose-file"),
  startTorrent: (filePath, destPath) =>
    ipcRenderer.send("start-torrent", filePath, destPath),
  onProgress: (callback) =>
    ipcRenderer.on("torrent-progress", (_, data) => callback(data)),
  chooseDestPath: () => ipcRenderer.invoke("choose-directory"),
});
