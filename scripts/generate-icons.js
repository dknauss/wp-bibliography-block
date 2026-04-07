/* eslint-disable no-console */
/**
 * Generate plugin icon PNGs using the dashicons "book" SVG path.
 * Matches the banner style: white background, dark charcoal (#3c434a) icon.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Dashicons "book" path (20x20 viewbox)
const BOOK_PATH =
	'M16 3H6.5C5.12 3 4 4.12 4 5.5v9C4 15.88 5.12 17 6.5 17H16V3z' +
	'M6.5 14.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5z' +
	'M14 14H8v-1h6v1z' +
	'm0-3H8V9h6v2z' +
	'm0-4H8V6h6v1z';

// CRC32
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
	const crcData = Buffer.concat([typeB, data]);
	const crcB = Buffer.alloc(4);
	crcB.writeUInt32BE(crc32(crcData) >>> 0, 0);
	return Buffer.concat([len, typeB, data, crcB]);
}

function encodePNG(pixels, width, height) {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6; // RGBA
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
	const compressed = zlib.deflateSync(raw);
	return Buffer.concat([
		signature,
		makeChunk('IHDR', ihdr),
		makeChunk('IDAT', compressed),
		makeChunk('IEND', Buffer.alloc(0)),
	]);
}

// Minimal SVG path parser
function parsePath(d) {
	const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
	const commands = [];
	let i = 0;
	while (i < tokens.length) {
		const cmd = tokens[i++];
		if (/[A-Za-z]/.test(cmd)) {
			const args = [];
			while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
				args.push(parseFloat(tokens[i++]));
			}
			commands.push({ cmd, args });
		}
	}
	return commands;
}

// Rasterize SVG path to alpha mask using scanline fill
function renderPathToMask(pathD, viewW, viewH, targetW, targetH) {
	const commands = parsePath(pathD);
	const mask = new Float32Array(targetW * targetH);

	const scaleX = targetW / viewW;
	const scaleY = targetH / viewH;

	// Build subpath polygons
	const polygons = [];
	let currentPoly = [];
	let cx = 0,
		cy = 0;
	let startX = 0,
		startY = 0;

	function pushPoint(x, y) {
		currentPoly.push([x * scaleX, y * scaleY]);
	}

	for (const { cmd, args } of commands) {
		const isRel = cmd === cmd.toLowerCase();
		switch (cmd.toUpperCase()) {
			case 'M': {
				if (currentPoly.length > 0) polygons.push(currentPoly);
				currentPoly = [];
				cx = isRel ? cx + args[0] : args[0];
				cy = isRel ? cy + args[1] : args[1];
				startX = cx;
				startY = cy;
				pushPoint(cx, cy);
				// Subsequent pairs are implicit L commands
				for (let j = 2; j < args.length; j += 2) {
					cx = isRel ? cx + args[j] : args[j];
					cy = isRel ? cy + args[j + 1] : args[j + 1];
					pushPoint(cx, cy);
				}
				break;
			}
			case 'L':
				for (let j = 0; j < args.length; j += 2) {
					cx = isRel ? cx + args[j] : args[j];
					cy = isRel ? cy + args[j + 1] : args[j + 1];
					pushPoint(cx, cy);
				}
				break;
			case 'H':
				for (let j = 0; j < args.length; j++) {
					cx = isRel ? cx + args[j] : args[j];
					pushPoint(cx, cy);
				}
				break;
			case 'V':
				for (let j = 0; j < args.length; j++) {
					cy = isRel ? cy + args[j] : args[j];
					pushPoint(cx, cy);
				}
				break;
			case 'C':
				for (let j = 0; j < args.length; j += 6) {
					let x1 = isRel ? cx + args[j] : args[j];
					let y1 = isRel ? cy + args[j + 1] : args[j + 1];
					let x2 = isRel ? cx + args[j + 2] : args[j + 2];
					let y2 = isRel ? cy + args[j + 3] : args[j + 3];
					let x3 = isRel ? cx + args[j + 4] : args[j + 4];
					let y3 = isRel ? cy + args[j + 5] : args[j + 5];
					for (let t = 0.02; t <= 1.0; t += 0.02) {
						const mt = 1 - t;
						const px =
							mt * mt * mt * cx +
							3 * mt * mt * t * x1 +
							3 * mt * t * t * x2 +
							t * t * t * x3;
						const py =
							mt * mt * mt * cy +
							3 * mt * mt * t * y1 +
							3 * mt * t * t * y2 +
							t * t * t * y3;
						pushPoint(px, py);
					}
					cx = x3;
					cy = y3;
				}
				break;
			case 'S': {
				// Smooth cubic — reflect previous control point
				for (let j = 0; j < args.length; j += 4) {
					let x2 = isRel ? cx + args[j] : args[j];
					let y2 = isRel ? cy + args[j + 1] : args[j + 1];
					let x3 = isRel ? cx + args[j + 2] : args[j + 2];
					let y3 = isRel ? cy + args[j + 3] : args[j + 3];
					// Use cx,cy as x1,y1 (simplified — no reflection tracking)
					for (let t = 0.02; t <= 1.0; t += 0.02) {
						const mt = 1 - t;
						const px =
							mt * mt * mt * cx +
							3 * mt * mt * t * cx +
							3 * mt * t * t * x2 +
							t * t * t * x3;
						const py =
							mt * mt * mt * cy +
							3 * mt * mt * t * cy +
							3 * mt * t * t * y2 +
							t * t * t * y3;
						pushPoint(px, py);
					}
					cx = x3;
					cy = y3;
				}
				break;
			}
			case 'Z':
				cx = startX;
				cy = startY;
				if (currentPoly.length > 0) {
					polygons.push(currentPoly);
					currentPoly = [];
				}
				break;
		}
	}
	if (currentPoly.length > 0) polygons.push(currentPoly);

	// Scanline fill with even-odd rule (XOR for subpath holes)
	for (const poly of polygons) {
		for (let y = 0; y < targetH; y++) {
			const intersections = [];
			for (let i = 0; i < poly.length; i++) {
				const [x1, y1] = poly[i];
				const [x2, y2] = poly[(i + 1) % poly.length];
				if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
					const t = (y - y1) / (y2 - y1);
					intersections.push(x1 + t * (x2 - x1));
				}
			}
			intersections.sort((a, b) => a - b);
			for (let i = 0; i < intersections.length - 1; i += 2) {
				const xStart = Math.max(0, Math.ceil(intersections[i]));
				const xEnd = Math.min(
					targetW - 1,
					Math.floor(intersections[i + 1])
				);
				for (let x = xStart; x <= xEnd; x++) {
					mask[y * targetW + x] = 1 - mask[y * targetW + x];
				}
			}
		}
	}
	return mask;
}

function createIcon(size) {
	const pixels = Buffer.alloc(size * size * 4);

	// Match banner: white bg, dark charcoal icon
	const bgR = 255,
		bgG = 255,
		bgB = 255;
	const fgR = 60,
		fgG = 67,
		fgB = 74; // #3c434a

	const pad = Math.round(size * 0.18);
	const innerSize = size - pad * 2;
	const mask = renderPathToMask(BOOK_PATH, 20, 20, innerSize, innerSize);

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const idx = (y * size + x) * 4;
			const iy = y - pad;
			const ix = x - pad;
			let alpha = 0;
			if (ix >= 0 && ix < innerSize && iy >= 0 && iy < innerSize) {
				alpha = mask[iy * innerSize + ix];
			}
			pixels[idx] = Math.round(bgR * (1 - alpha) + fgR * alpha);
			pixels[idx + 1] = Math.round(bgG * (1 - alpha) + fgG * alpha);
			pixels[idx + 2] = Math.round(bgB * (1 - alpha) + fgB * alpha);
			pixels[idx + 3] = 255;
		}
	}

	return encodePNG(pixels, size, size);
}

const dir = path.resolve(__dirname, '../.wordpress-org');
fs.writeFileSync(path.join(dir, 'icon-256x256.png'), createIcon(256));
fs.writeFileSync(path.join(dir, 'icon-128x128.png'), createIcon(128));
console.log('Icons created with dashicons book path');
