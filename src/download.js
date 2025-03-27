"use strict";

import net from "net";
import { Buffer } from "buffer";
import { getPeers } from "./tracker.js";
import {
  buildHandShake,
  buildInterested,
  buildRequest,
  parse,
} from "./message.js";
import Pieces from "./pieces.js";
import Queue from "./Queue.js";
import { closeSync, openSync, write } from "fs";

import cliProgress from "cli-progress";

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

export default (torrent, path) => {
  getPeers(torrent, (peers) => {
    const pieces = new Pieces(torrent);
    const file = openSync(path, "w");
    peers.forEach((peer) => download(peer, torrent, pieces, file));
  });
};

function download(peer, torrent, pieces, file) {
  const socket = new net.Socket();
  socket.on("error", (e) => {});
  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandShake(torrent));
  });
  const queue = new Queue(torrent);
  onWholeMessage(socket, (msg) =>
    msgHandler(msg, socket, pieces, queue, torrent, file)
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

function msgHandler(msg, socket, pieces, queue, torrent, file) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const m = parse(msg);

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
        pieceHandler(socket, pieces, queue, torrent, file, m.payload);
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

function pieceHandler(socket, pieces, queue, torrent, file, pieceResp) {
  if (!pieceHandlerStarted) {
    bar1.start(100, 0, {
      speed: "N/A",
    });
    pieceHandlerStarted = true;
  }
  //   console.log(pieceResp);
  pieces.addReceived(pieceResp);

  const offset =
    pieceResp.index * torrent.info["piece length"] + pieceResp.begin;

  write(file, pieceResp.block, 0, pieceResp.block.length, offset, () => {});

  if (pieces.isDone()) {
    bar1.update(100);
    // console.log("---------------DONE!---------------------");

    socket.end();
    try {
      closeSync(file);
      process.exit(0);
    } catch (e) {
      console.log(e);
    }
  } else {
    bar1.update(
      Math.ceil((pieces.totalReceivedBlocks / pieces.totalBlocks) * 100)
    );
    // process.stdout.write(
    //   `downloading... ${(
    //     (pieces.totalReceivedBlocks / pieces.totalBlocks) *
    //     100
    //   ).toPrecision(3)}%`
    // );
    // process.stdout.cursorTo(0);
    requestPiece(socket, pieces, queue);
  }
}

function requestPiece(socket, pieces, queue) {
  if (queue.choked) return null;

  while (queue.length()) {
    const pieceBlock = queue.deque();
    if (pieces.needed(pieceBlock)) {
      socket.write(buildRequest(pieceBlock));
      pieces.addRequested(pieceBlock);
      break;
    }
  }
}
