/**
 * Rebuild public/favicon.ico from public/favicon.svg.
 *
 * Frames: 16 and 32 for browser tabs (1x / 2x), 48 and 96 for Google, which
 * wants a square that is a multiple of 48px. Frames are stored as PNG inside
 * the ICO container, which every current browser and Windows Vista+ accept.
 *
 *   npm run favicon:build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const SIZES = [16, 32, 48, 96];
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/favicon.svg");
const icoPath = resolve(root, "public/favicon.ico");

async function main() {
  const svg = readFileSync(svgPath);
  const frames = await Promise.all(
    SIZES.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
  );

  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize + entrySize * frames.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = header.length;
  frames.forEach((png, i) => {
    const size = SIZES[i];
    const at = headerSize + i * entrySize;
    header.writeUInt8(size >= 256 ? 0 : size, at); // width
    header.writeUInt8(size >= 256 ? 0 : size, at + 1); // height
    header.writeUInt8(0, at + 2); // palette
    header.writeUInt8(0, at + 3); // reserved
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  const ico = Buffer.concat([header, ...frames]);
  writeFileSync(icoPath, ico);
  console.log(
    `wrote ${icoPath} (${ico.length} bytes, frames ${SIZES.join("/")})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
