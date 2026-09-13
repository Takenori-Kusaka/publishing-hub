import fs from 'node:fs';
import path from 'node:path';

/**
 * Detects the MIME type of an image file from its binary signature (magic bytes).
 *
 * @param {Buffer} buffer
 * @returns {string|null} - 'image/jpeg' or 'image/png' or null if unsupported
 */
export function detectMimeType(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }
  return null;
}

/**
 * Extracts width and height from PNG binary header.
 *
 * @param {Buffer} buffer
 * @returns {object} - { width, height }
 */
function getPngDimensions(buffer) {
  if (buffer.length < 24) {
    throw new Error('PNG buffer too short');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * Extracts width and height from JPEG binary markers.
 *
 * @param {Buffer} buffer
 * @returns {object} - { width, height }
 */
function getJpegDimensions(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) {
      throw new Error('Invalid JPEG marker structure');
    }
    const marker = buffer[i + 1];
    if (marker === 0xD9) {
      break; // End of image
    }
    const length = (buffer[i + 2] << 8) + buffer[i + 3];

    // SOF0 to SOF3 (Start of Frame) markers contain dimensions
    // 0xC0: SOF0, 0xC1: SOF1, 0xC2: SOF2, 0xC3: SOF3 (excluding 0xC4 DHT)
    if (marker >= 0xC0 && marker <= 0xC3 && marker !== 0xC4) {
      if (i + 8 >= buffer.length) {
        throw new Error('JPEG SOF segment too short');
      }
      const height = (buffer[i + 5] << 8) + buffer[i + 6];
      const width = (buffer[i + 7] << 8) + buffer[i + 8];
      return { width, height };
    }
    i += 2 + length;
  }
  throw new Error('JPEG dimensions not found');
}

/**
 * Strips APP1 (0xFFE1) EXIF chunks from a JPEG buffer in pure JS.
 *
 * @param {Buffer} buffer
 * @returns {Buffer} - EXIF-stripped JPEG buffer
 */
export function stripJpegExif(buffer) {
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return buffer; // Not a JPEG
  }

  let i = 2;
  const chunks = [buffer.subarray(0, 2)];

  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) {
      return buffer; // Invalid structure, fallback to original
    }
    const marker = buffer[i + 1];
    if (marker === 0xFF) {
      i += 1; // Fill byte before a marker
      continue;
    }
    if (marker === 0xD9) {
      chunks.push(buffer.subarray(i));
      break;
    }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      chunks.push(buffer.subarray(i, i + 2)); // Standalone markers carry no length
      i += 2;
      continue;
    }
    if (marker === 0xDA) {
      // SOS: entropy-coded image data follows until EOI. APP segments never appear after it, so copy the rest as is.
      chunks.push(buffer.subarray(i));
      break;
    }
    const length = (buffer[i + 2] << 8) + buffer[i + 3];

    // APP1 marker is 0xE1 (EXIF metadata)
    if (marker === 0xE1) {
      // Skip this segment entirely
      i += 2 + length;
    } else {
      chunks.push(buffer.subarray(i, i + 2 + length));
      i += 2 + length;
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Reads, validates, and processes an image to strip metadata and extract dimensions.
 * Source image remains completely untouched.
 *
 * @param {string} srcPath - Path to original source image
 * @param {string} destPath - Output path for processed image
 * @returns {object} - { width, height, mime, aspectRatio }
 */
export function processImage(srcPath, destPath) {
  const buffer = fs.readFileSync(srcPath);
  const mime = detectMimeType(buffer);

  if (!mime) {
    throw new Error(`Unsupported image signature for file: ${srcPath}. Only JPEG and PNG are supported.`);
  }

  let dimensions;
  let processedBuffer = buffer;

  if (mime === 'image/png') {
    dimensions = getPngDimensions(buffer);
  } else if (mime === 'image/jpeg') {
    dimensions = getJpegDimensions(buffer);
    processedBuffer = stripJpegExif(buffer);
  }

  // Ensure output directory exists before writing
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destPath, processedBuffer);

  return {
    width: dimensions.width,
    height: dimensions.height,
    mime,
    aspectRatio: dimensions.width / dimensions.height
  };
}
