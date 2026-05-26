#!/usr/bin/env node
// Genera los íconos PNG de la PWA desde el SVG del logo
// Ejecutar: node scripts/generate-icons.mjs

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "../public/icons");

mkdirSync(outputDir, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const s = size / 680; // scale factor

  // Background
  ctx.fillStyle = "#080b0f";
  roundRect(ctx, 0, 0, size, size, 80 * s);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = "rgba(0, 255, 136, 0.13)";
  ctx.lineWidth = 1 * s;
  for (let i = 1; i < 8; i++) {
    const pos = i * 85 * s;
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();
  }

  // Outer ring
  ctx.strokeStyle = "#00ffaa";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(340 * s, 340 * s, 210 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = "rgba(0, 255, 170, 0.27)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(340 * s, 340 * s, 240 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Corner brackets
  ctx.strokeStyle = "#00ffaa";
  ctx.lineWidth = 3 * s;
  const corners = [
    // top-left
    [[40, 40], [80, 40]], [[40, 40], [40, 80]],
    // top-right
    [[600, 40], [640, 40]], [[637, 40], [637, 80]],
    // bottom-left
    [[40, 637], [80, 637]], [[40, 600], [40, 640]],
    // bottom-right
    [[600, 637], [640, 637]], [[637, 600], [637, 640]],
  ];
  corners.forEach(([[x1, y1], [x2, y2]]) => {
    ctx.beginPath();
    ctx.moveTo(x1 * s, y1 * s);
    ctx.lineTo(x2 * s, y2 * s);
    ctx.stroke();
  });

  // Arrow →
  ctx.strokeStyle = "#00ffaa";
  ctx.lineWidth = 28 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(180 * s, 340 * s);
  ctx.lineTo(460 * s, 340 * s);
  ctx.stroke();
  // arrowhead top
  ctx.beginPath();
  ctx.moveTo(460 * s, 340 * s);
  ctx.lineTo(390 * s, 270 * s);
  ctx.stroke();
  // arrowhead bottom
  ctx.beginPath();
  ctx.moveTo(460 * s, 340 * s);
  ctx.lineTo(390 * s, 410 * s);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = "#00ffaa";
  ctx.beginPath();
  ctx.arc(340 * s, 340 * s, 14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#080b0f";
  ctx.beginPath();
  ctx.arc(340 * s, 340 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const icon192 = drawIcon(192);
writeFileSync(join(outputDir, "icon-192.png"), icon192);
console.log("✅ icon-192.png generated");

const icon512 = drawIcon(512);
writeFileSync(join(outputDir, "icon-512.png"), icon512);
console.log("✅ icon-512.png generated");

console.log("\n🎉 Icons ready in public/icons/");
