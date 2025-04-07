"use strict";

import { open } from "./src/torrent-parser.js";
import download from "./src/download.js";

const torrent = open(process.argv[2]);

download(torrent, torrent.info.name);
