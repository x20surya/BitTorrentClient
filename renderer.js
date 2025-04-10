const selectFileBtn = document.getElementById("selectFileBtn");
const torrentPath = document.getElementById("torrentPath");
const startBtn = document.getElementById("startBtn");
const selectDestBtn = document.getElementById("selectDestBtn");
const destPath = document.getElementById("destPath");
const progressBar = document.getElementById("bar")
const progressBarPercentage = document.getElementById("progressPercentage")
const logs = document.getElementById("logs")
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
    logs.textContent = "Downloading"
  }
  else {
    logs.textContent = "Enter all inputs"
  }
}
async function selectDest() {
  const res = await window.electronAPI.chooseDestPath();
  destPath.value = res;
}

window.electronAPI.onProgress((progress) => {
    progressBar.value = progress
    progressBarPercentage.textContent = `${progress}%`
    if(progress == 100) {
        logs.textContent = "Done."
    }
})
