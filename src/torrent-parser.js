"use strict";

import fs from "fs";
import bencode from "bencode";
import { createHash } from "crypto";
import { toBigIntBE, toBufferBE } from "@trufflesuite/bigint-buffer";

export function open(filepath) {
  return bencode.decode(fs.readFileSync(filepath));
}

export function size(torrent) {
  const size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b, 0)
    : torrent.info.length;

  return toBufferBE(BigInt(size), 8);
}

export function infoHash(torrent) {
  const info = bencode.encode(torrent.info);
  return createHash("sha1").update(info).digest();
}

export const BLOCK_LEN = Math.pow(2, 14);

export function pieceLen(torrent, pieceIndex) {
  const totalLength = Number(toBigIntBE(size(torrent)));
  const pieceLength = torrent.info["piece length"];

  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = Math.floor(totalLength / pieceLength);

  return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength;
}

export function blocksPerPiece(torrent, pieceIndex) {
  const pieceLength = pieceLen(torrent, pieceIndex);

  return Math.ceil(pieceLength / BLOCK_LEN);
}

export function blockLen(torrent, pieceIndex, blockIndex) {
  const pieceLength = pieceLen(torrent, pieceIndex);

  const lastPieceLength = pieceLength % BLOCK_LEN;
  const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN);

  return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN;
}
