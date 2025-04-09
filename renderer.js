const selectFileBtn = document.getElementById("selectFileBtn");
const torrentPath = document.getElementById("torrentPath");
const startBtn = document.getElementById("startBtn");
const selectDestBtn = document.getElementById("selectDestBtn");
const destPath = document.getElementById("destPath");
selectFileBtn.onclick = selectFile;
selectDestBtn.onclick = selectDest;
startBtn.onclick = startTorrent;

async function selectFile() {
  const res = await window.electronAPI.chooseSavePath();
  torrentPath.value = res;
}
async function startTorrent() {
  if (torrentPath.value != "" && destPath.value != "") {
    window.electronAPI.startTorrent(torrentPath.value, destPath.value);
    document.getElementById("logs").textContent = "Downloading"
  }
  else {
    document.getElementById("logs").textContent = "Enter all inputs"
  }
}
async function selectDest() {
  const res = await window.electronAPI.chooseDestPath();
  destPath.value = res;
}
