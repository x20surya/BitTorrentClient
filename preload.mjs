import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  chooseSavePath: () => ipcRenderer.invoke("choose-file"),
  startTorrent: (filePath, destPath) => ipcRenderer.invoke("start-torrent", filePath, destPath),
  chooseDestPath: () => ipcRenderer.invoke("choose-directory"),
});
