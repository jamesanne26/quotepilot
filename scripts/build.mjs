import { readFile, writeFile } from "node:fs/promises";

const app = await readFile(new URL("../src/ui/app.js", import.meta.url), "utf8");
await writeFile(new URL("../src/generated/client.js", import.meta.url), "export const clientApp = " + JSON.stringify(app) + ";\n");
console.log("Built browser client module.");
