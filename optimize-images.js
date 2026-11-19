const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'image');
const backupDir = path.join(imgDir, 'originals_backup');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function optimizeImages() {
    console.log('--- Starting Image Optimization ---');

    // 1. Optimize image-4.png
    const img4Source = path.join(imgDir, 'image-4.png');
    const img4Backup = path.join(backupDir, 'image-4.png');
    if (!fs.existsSync(img4Backup)) {
        fs.copyFileSync(img4Source, img4Backup);
    }
    const origSize4 = fs.statSync(img4Source).size / 1024;

    // Create optimized PNG (600px wide, high compression)
    const opt4Buffer = await sharp(img4Backup)
        .resize({ width: 600, withoutEnlargement: true })
        .png({ compressionLevel: 9, quality: 80, effort: 7 })
        .toBuffer();
    fs.writeFileSync(img4Source, opt4Buffer);
    const newSize4 = fs.statSync(img4Source).size / 1024;

    console.log(`image-4.png: ${origSize4.toFixed(1)} KB -> ${newSize4.toFixed(1)} KB (${((1 - newSize4 / origSize4) * 100).toFixed(1)}% reduction)`);

    // 2. Optimize Screenshot_20250826_234243_Perplexity.jpg (Breakfast)
    const shot1Name = 'Screenshot_20250826_234243_Perplexity.jpg';
    const shot1Source = path.join(imgDir, shot1Name);
    const shot1Backup = path.join(backupDir, shot1Name);
    if (!fs.existsSync(shot1Backup)) {
        fs.copyFileSync(shot1Source, shot1Backup);
    }
    const origSize1 = fs.statSync(shot1Source).size / 1024;

    const optShot1Buffer = await sharp(shot1Backup)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ progressive: true, quality: 80, mozjpeg: true })
        .toBuffer();
    fs.writeFileSync(shot1Source, optShot1Buffer);
    const newSize1 = fs.statSync(shot1Source).size / 1024;

    const meta1 = await sharp(shot1Source).metadata();
    console.log(`${shot1Name}: ${origSize1.toFixed(1)} KB -> ${newSize1.toFixed(1)} KB (isProgressive: ${meta1.isProgressive})`);

    // 3. Optimize Screenshot_20250827_112726_Perplexity.jpg (Juices)
    const shot2Name = 'Screenshot_20250827_112726_Perplexity.jpg';
    const shot2Source = path.join(imgDir, shot2Name);
    const shot2Backup = path.join(backupDir, shot2Name);
    if (!fs.existsSync(shot2Backup)) {
        fs.copyFileSync(shot2Source, shot2Backup);
    }
    const origSize2 = fs.statSync(shot2Source).size / 1024;

    const optShot2Buffer = await sharp(shot2Backup)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ progressive: true, quality: 80, mozjpeg: true })
        .toBuffer();
    fs.writeFileSync(shot2Source, optShot2Buffer);
    const newSize2 = fs.statSync(shot2Source).size / 1024;

    const meta2 = await sharp(shot2Source).metadata();
    console.log(`${shot2Name}: ${origSize2.toFixed(1)} KB -> ${newSize2.toFixed(1)} KB (isProgressive: ${meta2.isProgressive})`);

    console.log('--- Image Optimization Complete ---');
}

optimizeImages().catch(err => {
    console.error('Optimization error:', err);
    process.exit(1);
});
