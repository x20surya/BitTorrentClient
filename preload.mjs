import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  chooseSavePath: () => ipcRenderer.invoke("choose-directory"),
  startTorrent: (filePath) => ipcRenderer.invoke('start-torrent', filePath)
});
