// Registers the extension-less resolve hook for `node --test` (see loader.mjs).
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
