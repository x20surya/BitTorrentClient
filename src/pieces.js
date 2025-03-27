"use strict";

import { BLOCK_LEN, blocksPerPiece, pieceLen } from "./torrent-parser.js";

export default class Pieces {
  constructor(torrent) {
    function calculateTotalPieces() {
      let totalPieces = 0;
      const nFiles = torrent.info.files.length;

      for (let i = 0; i < nFiles; i++) {
        const fileLength = torrent.info.files[i].length;
        const piecesInFile = Math.ceil(
          fileLength / torrent.info["piece length"]
        );
        totalPieces += piecesInFile;
      }

      return totalPieces;
    }

    function buildPiecesArray() {
      const nPieces = calculateTotalPieces();
    //   console.log(nPieces);
      const arr = new Array(nPieces).fill(null);
      return arr.map((_, i) =>
        new Array(blocksPerPiece(torrent, i)).fill(false)
      );
    }
    this._requested = buildPiecesArray();
    this._received = buildPiecesArray();

    this.totalBlocks = this._requested
      .map((piece) => {
        return piece.reduce((count, _) => count + 1, 0);
      })
      .reduce((acc, curr) => acc + curr, 0);
    this.totalReceivedBlocks = 0;
  }

  addRequested(pieceBlock) {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this._requested[pieceBlock.index][blockIndex] = true;
  }

  addReceived(pieceBlock) {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this._received[pieceBlock.index][blockIndex] = true;
    this.totalReceivedBlocks = this.totalReceivedBlocks + 1;
  }

  needed(pieceBlock) {
    if (this._requested.every((blocks) => blocks.every((i) => i))) {
      this._requested = this._received.map((blocks) => blocks.slice());
    }
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    return !this._requested[pieceBlock.index][blockIndex];
  }

  isDone() {
    return this._received.every((blocks) => blocks.every((i) => i));
  }

  isPieceComplete(pieceIndex) {
    return this._received[pieceIndex].every((block) => block);
  }
}
