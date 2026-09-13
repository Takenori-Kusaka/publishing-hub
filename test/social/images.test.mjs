import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectMimeType, stripJpegExif, processImage } from '../../scripts/social/images.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.resolve(__dirname, '../../.tmp/test-images');

// 1x1 Transparent PNG binary data (Hex encoded)
const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789cc5c001090000000240010e0130182f0000000049454e44ae426082';
const pngBuffer = Buffer.from(pngHex, 'hex');

// 1x1 JPEG binary data with APP1 EXIF segment (Hex encoded)
// FF D8 (SOI)
// FF E1 (APP1 / EXIF) - length 00 0C (12 bytes) - dummy payload "Exif\0\0\0\0\0\0"
// FF C0 (SOF0) - length 00 0B - precision 08 - height 00 01 - width 00 01 - channels 01 ...
// FF D9 (EOI)
const jpegHex = 'ffd8ffe1000c45786966000000000000ffc0000b080001000101011100ffd9';
const jpegBuffer = Buffer.from(jpegHex, 'hex');

test('detectMimeType should identify JPEG and PNG from magic bytes', () => {
  assert.strictEqual(detectMimeType(pngBuffer), 'image/png');
  assert.strictEqual(detectMimeType(jpegBuffer), 'image/jpeg');
  assert.strictEqual(detectMimeType(Buffer.from([0, 1, 2, 3])), null);
});

test('stripJpegExif should strip APP1 markers successfully', () => {
  const stripped = stripJpegExif(jpegBuffer);
  // Verify APP1 marker (FF E1) is no longer present in the stripped buffer
  const hasApp1 = stripped.toString('hex').includes('ffe1');
  assert.strictEqual(hasApp1, false);
  // Confirm SOI (ffd8) and EOI (ffd9) are still present
  assert.strictEqual(stripped.subarray(0, 2).toString('hex'), 'ffd8');
  assert.strictEqual(stripped.subarray(-2).toString('hex'), 'ffd9');
});

test('stripJpegExif strips APP1 before SOS and keeps the entropy-coded data (including 0xFF00 stuffing) intact', () => {
  // SOI, APP1(EXIF), SOF0, SOS(header), entropy data with a stuffed 0xFF00 and a restart marker, EOI
  const entropy = '12ff0034ffd05678';
  const hex = 'ffd8' + 'ffe1000c457869660000000000000000'.slice(0, 28) + 'ffc0000b080001000101011100' + 'ffda000801010000003f00' + entropy + 'ffd9';
  const input = Buffer.from(hex, 'hex');
  const out = stripJpegExif(input);
  assert.ok(!out.toString('hex').includes('ffe1'), 'APP1 removed');
  assert.ok(out.toString('hex').includes('ffda000801010000003f00' + entropy + 'ffd9'), 'scan data and EOI copied verbatim');
  assert.strictEqual(out.length, input.length - 14);
});

test('stripJpegExif leaves a real photo without APP1 byte-for-byte unchanged', () => {
  const real = fs.readFileSync(path.resolve(__dirname, '../../images/pit-in-process/ch-bandwidth.jpeg'));
  assert.ok(stripJpegExif(real).equals(real));
});

test('processImage should successfully parse and process JPEG and PNG without touching sources', () => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const srcPng = path.join(tmpDir, 'src-1x1.png');
  const destPng = path.join(tmpDir, 'dest-1x1.png');
  fs.writeFileSync(srcPng, pngBuffer);

  const srcJpeg = path.join(tmpDir, 'src-1x1.jpg');
  const destJpeg = path.join(tmpDir, 'dest-1x1.jpg');
  fs.writeFileSync(srcJpeg, jpegBuffer);

  // 1. Process PNG
  const pngResult = processImage(srcPng, destPng);
  assert.strictEqual(pngResult.width, 1);
  assert.strictEqual(pngResult.height, 1);
  assert.strictEqual(pngResult.mime, 'image/png');
  assert.strictEqual(pngResult.aspectRatio, 1);
  assert.strictEqual(fs.existsSync(destPng), true);

  // 2. Process JPEG
  const jpegResult = processImage(srcJpeg, destJpeg);
  assert.strictEqual(jpegResult.width, 1);
  assert.strictEqual(jpegResult.height, 1);
  assert.strictEqual(jpegResult.mime, 'image/jpeg');
  assert.strictEqual(jpegResult.aspectRatio, 1);
  assert.strictEqual(fs.existsSync(destJpeg), true);

  // Verify EXIF was stripped in destJpeg but not srcJpeg
  const destJpegBuffer = fs.readFileSync(destJpeg);
  assert.strictEqual(destJpegBuffer.toString('hex').includes('ffe1'), false);
  assert.strictEqual(fs.readFileSync(srcJpeg).toString('hex').includes('ffe1'), true);

  // Clean up
  fs.unlinkSync(srcPng);
  fs.unlinkSync(destPng);
  fs.unlinkSync(srcJpeg);
  fs.unlinkSync(destJpeg);
  fs.rmdirSync(tmpDir);
});
