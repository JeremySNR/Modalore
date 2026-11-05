import { promises as fs } from "node:fs";
const packages = [
  "react",
  "react-dom",
  "scheduler",
  "lucide-react",
  "yauzl",
  "pend",
];
let text =
  "# Third-party notices\n\nThese components are bundled into Modalore. Electron and Chromium notices are also included alongside the installed executable. Optional Luanti/Minetest Game downloads retain their upstream licenses and are not covered by Modalore's MIT license.\n";
for (const name of packages) {
  const pkg = JSON.parse(
    await fs.readFile(`node_modules/${name}/package.json`, "utf8"),
  );
  const license = await fs.readFile(`node_modules/${name}/LICENSE`, "utf8");
  text += `\n## ${name} ${pkg.version}\n\n${license.trim()}\n`;
}
await fs.writeFile("THIRD_PARTY_NOTICES.md", text);
