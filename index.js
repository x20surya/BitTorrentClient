"use strict";

import { open } from "./src/torrent-parser.js";
import download from "./src/download.js";

// const torrent = open("electronics.torrent");

// download(torrent, torrent.info.name);

export { download, open };
