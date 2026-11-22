const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'image');
const backupDir = path.join(imgDir, 'originals_backup');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function optimize(fileName, width) {
    const src = path.join(imgDir, fileName);
    const backup = path.join(backupDir, fileName);
    if (!fs.existsSync(backup)) {
        fs.copyFileSync(src, backup);
    }
    const origSize = fs.statSync(src).size / 1024;

    const optBuffer = await sharp(backup)
        .resize({ width, withoutEnlargement: true })
        .png({ compressionLevel: 9, quality: 80, effort: 7 })
        .toBuffer();

    fs.writeFileSync(src, optBuffer);
    const newSize = fs.statSync(src).size / 1024;
    console.log(`${fileName}: ${origSize.toFixed(1)} KB -> ${newSize.toFixed(1)} KB (${((1 - newSize / origSize) * 100).toFixed(1)}% reduction)`);
}

async function run() {
    console.log('--- Optimizing Remaining Heavy Images ---');
    await optimize('image-1.png', 600);
    await optimize('image-3.png', 600);
    await optimize('image-5.png', 600);
    console.log('--- Done! ---');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
