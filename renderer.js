const selectFileBtn = document.getElementById("selectFileBtn")
const torrentPath = document.getElementById("torrentPath")
const startBtn = document.getElementById("startBtn")
selectFileBtn.onclick = selectFile
startBtn.onclick = startTorrent

async function selectFile(){
    const res = await window.electronAPI.chooseSavePath();
    torrentPath.value = res
}
async function startTorrent() {
    if(torrentPath.value != ""){
        window.electronAPI.startTorrent(torrentPath.value)
    }
}