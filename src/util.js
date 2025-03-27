"use strict";

import { randomBytes } from "crypto";

let id = null;

export const genId = () => {
  if (!id) {
    id = randomBytes(20);
    Buffer.from("-ST0001-").copy(id, 0);
  }
  return id;
};
