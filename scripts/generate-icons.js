/* eslint-disable no-console */
/**
 * Generate plugin icon PNGs from the dashicons "book" glyph.
 * Extracts the glyph from the dashicons TTF font, rasterizes it
 * on a white background with dark charcoal fill to match the banners.
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requires: opentype.js (npm install --no-save opentype.js)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const opentype = require('opentype.js');

const FONT_PATH = path.resolve(
	__dirname,
	'../node_modules/dashicons/fonts/dashicons.ttf'
);
const OUTPUT_DIR = path.resolve(__dirname, '../.wordpress-org');

// dashicons-book = U+F330
const BOOK_CODEPOINT = 0xf330;

// Colors matching the banner
const BG = { r: 255, g: 255, b: 255 };
const FG = { r: 60, g: 67, b: 74 }; // #3c434a

// --- PNG encoder (no dependencies) ---

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
	let c = n;
	for (let k = 0; k < 8; k++)
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	crcTable[n] = c;
}

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++)
		c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return c ^ 0xffffffff;
}

function makeChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeB = Buffer.from(type);
	const crcB = Buffer.alloc(4);
	crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])) >>> 0, 0);
	return Buffer.concat([len, typeB, data, crcB]);
}

function encodePNG(pixels, width, height) {
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc(height * (1 + width * 4));
	for (let y = 0; y < height; y++) {
		raw[y * (1 + width * 4)] = 0;
		pixels.copy(
			raw,
			y * (1 + width * 4) + 1,
			y * width * 4,
			(y + 1) * width * 4
		);
	}
	return Buffer.concat([
		sig,
		makeChunk('IHDR', ihdr),
		makeChunk('IDAT', zlib.deflateSync(raw)),
		makeChunk('IEND', Buffer.alloc(0)),
	]);
}

// --- Glyph rasterizer using supersampling ---

function rasterizeGlyph(glyph, size, padding) {
	const inner = size - padding * 2;

	// Supersample at 4x for anti-aliasing
	const ss = 4;
	const ssSize = size * ss;
	const ssMask = new Uint8Array(ssSize * ssSize);

	// Render at a reference font size, then measure the actual path bounds
	const refSize = 1000;
	const p = glyph.getPath(0, 0, refSize);

	// Collect subpath polygons from path commands
	const polygons = [];
	let currentPoly = [];
	let cx = 0,
		cy = 0;

	for (const cmd of p.commands) {
		switch (cmd.type) {
			case 'M':
				if (currentPoly.length > 1) polygons.push(currentPoly);
				currentPoly = [];
				cx = cmd.x;
				cy = cmd.y;
				currentPoly.push([cx, cy]);
				break;
			case 'L':
				cx = cmd.x;
				cy = cmd.y;
				currentPoly.push([cx, cy]);
				break;
			case 'Q':
				for (let t = 0.02; t <= 1.0; t += 0.02) {
					const mt = 1 - t;
					const px = mt * mt * cx + 2 * mt * t * cmd.x1 + t * t * cmd.x;
					const py = mt * mt * cy + 2 * mt * t * cmd.y1 + t * t * cmd.y;
					currentPoly.push([px, py]);
				}
				cx = cmd.x;
				cy = cmd.y;
				break;
			case 'C':
				for (let t = 0.02; t <= 1.0; t += 0.02) {
					const mt = 1 - t;
					const px =
						mt * mt * mt * cx +
						3 * mt * mt * t * cmd.x1 +
						3 * mt * t * t * cmd.x2 +
						t * t * t * cmd.x;
					const py =
						mt * mt * mt * cy +
						3 * mt * mt * t * cmd.y1 +
						3 * mt * t * t * cmd.y2 +
						t * t * t * cmd.y;
					currentPoly.push([px, py]);
				}
				cx = cmd.x;
				cy = cmd.y;
				break;
			case 'Z':
				if (currentPoly.length > 1) polygons.push(currentPoly);
				currentPoly = [];
				break;
		}
	}
	if (currentPoly.length > 1) polygons.push(currentPoly);

	// Compute actual bounds of the path points
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const poly of polygons) {
		for (const [x, y] of poly) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}

	const pathW = maxX - minX;
	const pathH = maxY - minY;
	const scale = Math.min(inner / pathW, inner / pathH);

	// Center within the padded area (no Y flip — getPath returns screen coords)
	const scaledW = pathW * scale;
	const scaledH = pathH * scale;
	const offsetX = padding + (inner - scaledW) / 2 - minX * scale;
	const offsetY = padding + (inner - scaledH) / 2 - minY * scale;

	// Transform polygons to supersampled pixel space
	const scaledPolys = polygons.map((poly) =>
		poly.map(([x, y]) => [
			(x * scale + offsetX) * ss,
			(y * scale + offsetY) * ss,
		])
	);

	// Scanline fill with non-zero winding rule (correct for font glyphs)
	for (let y = 0; y < ssSize; y++) {
		const crossings = [];
		for (const poly of scaledPolys) {
			for (let i = 0; i < poly.length; i++) {
				const [x1, y1] = poly[i];
				const [x2, y2] = poly[(i + 1) % poly.length];
				if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
					const t = (y - y1) / (y2 - y1);
					const xInt = x1 + t * (x2 - x1);
					const dir = y2 > y1 ? 1 : -1;
					crossings.push({ x: xInt, dir });
				}
			}
		}
		crossings.sort((a, b) => a.x - b.x);

		// Walk crossings left-to-right, tracking winding number.
		// Fill the span between consecutive crossings when winding != 0.
		let winding = 0;
		for (let i = 0; i < crossings.length - 1; i++) {
			winding += crossings[i].dir;
			if (winding !== 0) {
				const xStart = Math.max(0, Math.ceil(crossings[i].x));
				const xEnd = Math.min(
					ssSize - 1,
					Math.floor(crossings[i + 1].x)
				);
				for (let x = xStart; x <= xEnd; x++) {
					ssMask[y * ssSize + x] = 1;
				}
			}
		}
	}

	// Downsample to target size
	const alpha = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let sum = 0;
			for (let sy = 0; sy < ss; sy++) {
				for (let sx = 0; sx < ss; sx++) {
					sum += ssMask[(y * ss + sy) * ssSize + (x * ss + sx)];
				}
			}
			alpha[y * size + x] = sum / (ss * ss);
		}
	}

	// Render to RGBA pixels
	const pixels = Buffer.alloc(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		const a = alpha[i];
		const idx = i * 4;
		pixels[idx] = Math.round(BG.r * (1 - a) + FG.r * a);
		pixels[idx + 1] = Math.round(BG.g * (1 - a) + FG.g * a);
		pixels[idx + 2] = Math.round(BG.b * (1 - a) + FG.b * a);
		pixels[idx + 3] = 255;
	}

	return encodePNG(pixels, size, size);
}

// --- Main ---

const font = opentype.loadSync(FONT_PATH);
const glyph = font.charToGlyph(String.fromCodePoint(BOOK_CODEPOINT));

if (!glyph || glyph.index === 0) {
	console.error('Could not find dashicons-book glyph at U+F330');
	process.exit(1);
}

console.log(
	'Found glyph: index=%d, advanceWidth=%d',
	glyph.index,
	glyph.advanceWidth
);

fs.writeFileSync(
	path.join(OUTPUT_DIR, 'icon-256x256.png'),
	rasterizeGlyph(glyph, 256, 30)
);
fs.writeFileSync(
	path.join(OUTPUT_DIR, 'icon-128x128.png'),
	rasterizeGlyph(glyph, 128, 15)
);
console.log('Icons saved to %s/', OUTPUT_DIR);
