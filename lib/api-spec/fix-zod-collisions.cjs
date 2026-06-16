const fs = require("fs");
const path = require("path");

const typesIndex = path.resolve(__dirname, "../api-zod/src/generated/types/index.ts");
let content = fs.readFileSync(typesIndex, "utf8");

// These names are generated as both TypeScript types (in generated/types/) AND
// as Zod schemas (in generated/api.ts), causing duplicate-export collisions.
// Remove the type-only barrel re-exports so the Zod schema versions win.
const collisions = ["sendDirectMessageBody", "getChatMessagesParams"];
for (const name of collisions) {
  content = content.replace(`export * from './${name}';\n`, "");
}

fs.writeFileSync(typesIndex, content);
console.log("Removed", collisions.length, "Zod collision(s) from types barrel.");
