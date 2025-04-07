"use strict";

import dgram from "dgram";
import { Buffer } from "buffer";
import { URL } from "url";
import { randomBytes } from "crypto";
import * as torrentParser from "./torrent-parser.js";
import * as util from "./util.js";
import { resolve } from "path";

export const getPeers = async (torrent, callback) => {

  const decoder = new TextDecoder();
  const trackers = [];

  trackers.push(new URL(decoder.decode(torrent.announce)));

  torrent["announce-list"].forEach((announce) => {
    const url = new URL(decoder.decode(announce[0]));
    if (url.protocol === "udp:") {
      trackers.push(url);
    }
  });

  for (let i = 0; i < trackers.length; i++) {
    try {
      const peers = await attemptTracker(trackers[i], torrent);
      if(peers && peers.length) {
        callback(peers);
        return;
      }
    } catch (err) {
      console.log(`No response from tracker ${trackers[i].href}: ${err.message}`)
    }
  }

  function attemptTracker(trackerUrl, torrent) {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      let responded = false;

      const timeout = setTimeout(() => {
        if(!responded) {
          socket.close()
          reject(new Error("Tracker did not responde in "))
        }
      }, 5000)

      socket.on("message", (response) => {
        if (!responded) {
          const type = respType(response);
          if (type === "connect") {
            const connResp = parseConnResp(response);
            const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
            udpSend(socket, announceReq, trackerUrl);
          } else if (type === "announce") {
            responded = true;
            clearTimeout(timeout);
            const announceResp = parseAnnounceResp(response);
            resolve(announceResp.peers);
            socket.close();
          }
        }
      });

      udpSend(socket, buildConnReq(), trackerUrl);
    })
  }

};

function udpSend(socket, message, rawUrl, callback = (err) => console.log) {
  socket.send(
    message,
    0,
    message.length,
    rawUrl.port,
    rawUrl.hostname,
    callback
  );
}

function respType(resp) {
  const action = resp.readUInt32BE(0);
  if (action === 0) return "connect";
  if (action === 1) return "announce";
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  // connection id
  buf.writeUint32BE(0x417, 0);
  buf.writeUint32BE(0x27101980, 4);
  //action
  buf.writeUint32BE(0, 8);
  //transaction id
  randomBytes(4).copy(buf, 12);

  return buf;
}

function parseConnResp(resp) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8),
  };
}

function buildAnnounceReq(connId, torrent, port = 6881) {
  const buf = Buffer.allocUnsafe(98);

  //connection id
  connId.copy(buf, 0);
  //action
  buf.writeUint32BE(1, 8);
  //transaction id
  randomBytes(4).copy(buf, 12);
  // info hash
  torrentParser.infoHash(torrent).copy(buf, 16);
  // peer Id
  util.genId().copy(buf, 36);
  // download
  Buffer.alloc(8).copy(buf, 56);
  // left
  torrentParser.size(torrent).copy(buf, 64);
  // uploaded
  Buffer.alloc(8).copy(buf, 72);
  //event
  buf.writeUint32BE(0, 80);
  // ipaddress
  buf.writeUint32BE(0, 84);
  // key
  randomBytes(4).copy(buf, 88);
  //num want
  buf.writeInt32BE(-1, 92);
  // port
  buf.writeInt16BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp) {
  function group(iterable, groupSize) {
    let groups = [];
    for (let i = 0; i < iterable.length; i += groupSize) {
      groups.push(iterable.slice(i, i + groupSize));
    }
    return groups;
  }

  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    leechers: resp.readUInt32BE(8),
    seeders: resp.readUInt32BE(12),
    peers: group(resp.slice(20), 6).map((address) => {
      return {
        ip: address.slice(0, 4).join("."),
        port: address.readUInt16BE(4),
      };
    }),
    nPeers: group(resp.slice(20), 6).length,
  };
}
