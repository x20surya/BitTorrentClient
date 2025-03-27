"use strict";

import dgram from "dgram";
import { Buffer } from "buffer";
import { URL } from "url";
import { randomBytes } from "crypto";
import { infoHash, size } from "./torrent-parser.js";
import { genId } from "./util.js";

export const getPeers = (torrent, callback) => {
  const socket = dgram.createSocket("udp4");
  const url = new URL(new TextDecoder().decode(torrent.announce));

  // 1. send connect request
  //   torrent["announce-list"].forEach((element) => {
  //     const url = element[0];
  //     console.log(url);
  //     udpSend(socket, buildConnReq(), "udp://tracker.opentrackr.org:1337/announce");
  //   });

  udpSend(socket, buildConnReq(), url);

  socket.on("message", (response) => {
    if (respType(response) === "connect") {
      // 2. recieve and parse connect response
      const connResp = parseConnResp(response);
      console.log(
        "\n--------------- received connect response from tracker! -----------\n"
      );
      // 3. send announce request
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, url);
    } else if (respType(response) === "announce") {
      // 4. parse announce response
      const announceResp = parseAnnounceResp(response);
      console.log(
        `\n----------------received no of peers ${announceResp.nPeers} --------------\n`
      );
      // 5. pass peers to callback
      callback(announceResp.peers);
    }
  });
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
  infoHash(torrent).copy(buf, 16);
  // peer Id
  genId().copy(buf, 36);
  // download
  Buffer.alloc(8).copy(buf, 56);
  // left
  size(torrent).copy(buf, 64);
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
