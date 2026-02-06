const https = require("https");
const fs = require("fs");
const path = require("path");

const SOURCE_URL =
  "https://raw.githubusercontent.com/bnjasim/quranic-corpus/master/quranic-corpus-morphology-0.4.txt";

const destDir = path.join(__dirname, "..", "public", "data");
const destFile = path.join(destDir, "quranic-corpus-morphology-0.4.txt");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(destFile) && fs.statSync(destFile).size > 0) {
  console.log("Morphology data already present:", destFile);
  process.exit(0);
}

console.log("Downloading morphology dataset...");

const file = fs.createWriteStream(destFile);
https
  .get(SOURCE_URL, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Download failed: ${res.statusCode} ${res.statusMessage}`);
      process.exit(1);
    }
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Downloaded morphology dataset to:", destFile);
    });
  })
  .on("error", (err) => {
    fs.unlink(destFile, () => {
      console.error("Download error:", err.message);
      process.exit(1);
    });
  });
