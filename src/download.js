"use strict";

import net from "net";
import { Buffer } from "buffer";
import * as tracker from "./tracker.js";
import * as message from "./message.js";
import Pieces from "./pieces.js";
import Queue from "./Queue.js";
import fs from "fs";

import cliProgress from "cli-progress";

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

export default (torrent, path) => {
  tracker.getPeers(torrent, (peers) => {
    const pieces = new Pieces(torrent);

    fs.mkdirSync(path, (err) => {
      console.log(err);
      return;
    });

    const pathInString = new TextDecoder().decode(path);

    const files = initializeFiles(torrent, path);
    console.log(files);
    files.forEach((file) => {
      if (file.path.length > 1) {
        mkdirRecurssive(0, file.path);
      }
      file.descriptor = fs.openSync(`${pathInString}/${file.path.join("/")}`, "w");
    });

    function mkdirRecurssive(n, path) {
      if (n + 1 == path.length) {
        return;
      } else {
        const newarr = path.slice(0, n + 1);
        if (!fs.existsSync(`${pathInString}/${newarr.join("/")}`)) {
          fs.mkdirSync(`${pathInString}/${newarr.join("/")}`, (err) => {
            console.log(err);
          });
        }
        mkdirRecurssive(n + 1, path);
      }
    }

    peers.forEach((peer) => download(peer, torrent, pieces, files));
  });
};

function initializeFiles(torrent, path) {
  const files = [];
  const nFiles = torrent.info.files.length;

  let offset = 0;
  for (let i = 0; i < nFiles; i++) {
    const fileLength = torrent.info.files[i].length;
    const decoder = new TextDecoder();
    const filePath = torrent.info.files[i].path.map((item) =>
      decoder.decode(item)
    );

    files.push({
      length: fileLength,
      path: filePath,
      descriptor: null,
      offset: offset,
    });

    offset += Math.floor(fileLength / torrent.info["piece length"]);
  }

  return files;
}

function download(peer, torrent, pieces, files) {
  const socket = new net.Socket();
  socket.on("error", (e) => {});
  socket.connect(peer.port, peer.ip, () => {
    socket.write(message.buildHandShake(torrent));
  });
  const queue = new Queue(torrent);
  onWholeMessage(socket, (msg) =>
    msgHandler(msg, socket, pieces, queue, torrent, files)
  );
}

function onWholeMessage(socket, callback) {
  let savedBuffer = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (receivedBuffer) => {
    // msgLength calculates the length of whole message in bytes
    function msgLength() {
      return handshake
        ? savedBuffer.readUInt8(0) + 49
        : savedBuffer.readInt32BE(0) + 4;
    }
    savedBuffer = Buffer.concat([savedBuffer, receivedBuffer]);

    while (savedBuffer.length >= 4 && savedBuffer.length >= msgLength()) {
      callback(savedBuffer.subarray(0, msgLength()));
      savedBuffer = savedBuffer.subarray(msgLength()); // clear saved buffer
      handshake = false;
    }
  });
}

function msgHandler(msg, socket, pieces, queue, torrent, files) {
  if (isHandshake(msg)) {
    socket.write(message.buildInterested());
  } else {
    const m = message.parse(msg);

    switch (m.id) {
      case 0: {
        chokeHandler(socket);
        break;
      }
      case 1: {
        unchokeHandler(socket, pieces, queue);
        break;
      }
      case 4: {
        haveHandler(socket, pieces, queue, m.payload);
        break;
      }
      case 5: {
        bitfieldHandler(socket, pieces, queue, m.payload);
        break;
      }
      case 7: {
        pieceHandler(socket, pieces, queue, torrent, files, m.payload);
        break;
      }
    }
  }
}

function isHandshake(msg) {
  return (
    msg.length === msg.readUInt8(0) + 49 &&
    msg.toString("utf8", 1) === "BitTorrent protocol"
  );
}

function chokeHandler(socket) {
  socket.end();
}

function unchokeHandler(socket, pieces, queue) {
  queue.choked = false;
  requestPiece(socket, pieces, queue);
}

function haveHandler(socket, pieces, queue, payload) {
  const pieceIndex = payload.readUInt32BE(0);
  const queueEmpty = queue.length === 0;
  queue.queue(pieceIndex);
  if (queueEmpty) {
    requestPiece(socket, pieces, queue);
  }
}

function bitfieldHandler(socket, pieces, queue, payload) {
  const queueEmpty = queue.length === 0;
  payload.forEach((byte, i) => {
    for (let j = 0; j < 8; j++) {
      if (byte % 2) queue.queue(i * 8 + 7 - j);
      byte = Math.floor(byte / 2);
    }
  });
  if (queueEmpty) requestPiece(socket, pieces, queue);
}

let pieceHandlerStarted = false;

function pieceHandler(socket, pieces, queue, torrent, files, pieceResp) {
  if (!pieceHandlerStarted) {
    bar1.start(100, 0, {
      speed: "N/A",
    });
    pieceHandlerStarted = true;
  }
  //   console.log(pieceResp);
  const fileIndex = findFileIndex(torrent, files, pieceResp.index);

  const file = files[fileIndex];

  const relativePieceIndex = pieceResp.index - file.offset;

  pieces.addReceived(pieceResp);

  const offset =
    file.offset +
    relativePieceIndex * torrent.info["piece length"] +
    pieceResp.begin;

  fs.write(
    file.descriptor,
    pieceResp.block,
    0,
    pieceResp.block.length,
    offset,
    () => {}
  );

  if (pieces.isDone()) {
    bar1.update(100);
    // console.log("---------------DONE!---------------------");

    socket.end();
    try {
      fs.closeSync(file.descriptor);
      process.exit(0);
    } catch (e) {
      console.log(e);
    }
  } else {
    bar1.update(
      Math.ceil((pieces.totalReceivedBlocks / pieces.totalBlocks) * 100)
    );
    requestPiece(socket, pieces, queue);
  }
}

function findFileIndex(torrent, files, pieceIndex) {
  let offset = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const piecesInFile = Math.ceil(file.length / torrent.info["piece length"]);

    if (pieceIndex < offset + piecesInFile) {
      return i;
    }

    offset += piecesInFile;
  }

  return -1; // error: piece index does not correspond to any file
}

function requestPiece(socket, pieces, queue) {
  if (queue.choked) return null;

  while (queue.length()) {
    const pieceBlock = queue.deque();
    if (pieces.needed(pieceBlock)) {
      socket.write(message.buildRequest(pieceBlock));
      pieces.addRequested(pieceBlock);
      break;
    }
  }
}
