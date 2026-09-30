/** Draws a compact, color-coded agility obstacle on the course canvas. */
const hueOffsets = { jump: 0, tunnel: 130, weave: 85, tire: -105, table: -170, marker: 160 };

const obstacleNames = {
  jump: 'Stacjonata',
  tunnel: 'Tunel',
  weave: 'Slalom',
  tire: 'Koło',
  table: 'Stół',
  marker: 'Znacznik',
};

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}

function obstacleColor(base, type) {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(base || '');
  if (!match) return `hsl(${(155 + (hueOffsets[type] || 0) + 360) % 360} 58% 34%)`;
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }
  const lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0.5;
  const adjustedHue = (hue + (hueOffsets[type] || 0) + 360) % 360;
  return `hsl(${adjustedHue} ${Math.max(48, Math.min(78, saturation * 100))}% 34%)`;
}

function drawSymbol(ctx, type, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'jump') {
    // Two uprights and two rails make the jump unmistakable at small sizes.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-27, -18); ctx.lineTo(-27, 18);
    ctx.moveTo(27, -18); ctx.lineTo(27, 18);
    ctx.moveTo(-30, -12); ctx.lineTo(30, -12);
    ctx.moveTo(-30, 7); ctx.lineTo(30, 7);
    ctx.stroke();
    ctx.fillStyle = '#e7a640';
    roundedRect(ctx, -24, -14, 48, 5, 2);
    ctx.fill();
  } else if (type === 'tunnel') {
    ctx.beginPath();
    ctx.moveTo(-31, 17); ctx.lineTo(-31, -2);
    ctx.quadraticCurveTo(0, -35, 31, -2);
    ctx.lineTo(31, 17); ctx.quadraticCurveTo(0, -5, -31, 17);
    ctx.closePath();
    ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 17, 31, 8, 0, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(12, 4);
    ctx.lineTo(5, -2); ctx.moveTo(12, 4); ctx.lineTo(5, 10); ctx.stroke();
  } else if (type === 'weave') {
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 10;
      const lean = i % 2 ? 4 : -4;
      ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + lean, 20); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, -20, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(-28, 22); ctx.lineTo(28, 22); ctx.stroke();
  } else if (type === 'tire') {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, -3, 19, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(22, 22);
    ctx.moveTo(-15, 18); ctx.lineTo(-15, 28);
    ctx.moveTo(15, 18); ctx.lineTo(15, 28); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -3, 3, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'table') {
    ctx.lineWidth = 4;
    roundedRect(ctx, -27, -14, 54, 31, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    [[-17, -5], [17, -5], [-17, 8], [17, 8]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.stroke();
    });
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-21, 17); ctx.lineTo(-21, 23);
    ctx.moveTo(21, 17); ctx.lineTo(21, 23); ctx.stroke();
  } else {
    // Number/marker sign with a weighted, visible base.
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-22, 21); ctx.lineTo(22, 21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 19); ctx.lineTo(0, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -18); ctx.lineTo(24, -13); ctx.lineTo(2, -3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(18, -13); ctx.stroke();
  }
}

export function drawObstacle(ctx, canvas, obstacle, selected, state) {
  const x = obstacle.x * canvas.width;
  const y = obstacle.y * canvas.height;
  const color = obstacleColor(state.ob, obstacle.type);
  const label = obstacle.label || obstacleNames[obstacle.type] || 'Przeszkoda';

  ctx.save();
  ctx.translate(x, y);

  if (selected) {
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#f078511c'; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#e56d49'; ctx.lineWidth = 2; ctx.stroke();
  }

  roundedRect(ctx, -43, -38, 86, 80, 15);
  ctx.fillStyle = '#fffdf5'; ctx.fill();
  ctx.strokeStyle = selected ? '#e56d49' : `${color}66`;
  ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();

  ctx.beginPath(); ctx.arc(0, 1, 31, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 1;
  drawSymbol(ctx, obstacle.type, color);

  if (state.showNumbers) {
    ctx.beginPath(); ctx.arc(34, -31, 12, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 11px "DM Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(obstacle.n, 34, -31);
  }

  ctx.fillStyle = '#26352f';
  ctx.font = '600 9px "DM Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(label.length > 15 ? `${label.slice(0, 14)}…` : label, 0, 27, 78);
  ctx.restore();
}

