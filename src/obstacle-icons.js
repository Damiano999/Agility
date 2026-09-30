const iconFiles = {
  jump: 'jump.png', wall: 'wall.png',
  longJump: 'long-jump.png', tire: 'tire.png', aFrame: 'a-frame.png',
  dogWalk: 'dog-walk.png', seesaw: 'seesaw.png', tunnel: 'tunnel.png',
  weave: 'weave.png',
};

const names = {
  jump: 'Skok pojedynczy',
  wall: 'Ściana / panel', longJump: 'Skok w dal', tire: 'Koło', aFrame: 'Palizada A',
  dogWalk: 'Kładka', seesaw: 'Huśtawka', tunnel: 'Tunel', weave: 'Slalom',
};

const icons = Object.fromEntries(Object.entries(iconFiles).map(([type, file]) => {
  const image = new Image();
  image.src = new URL(`../assets/obstacles/${file}`, import.meta.url);
  image.onload = () => window.dispatchEvent(new Event('agility-icons-ready'));
  image.onerror = () => window.dispatchEvent(new CustomEvent('agility-asset-error', { detail: file }));
  return [type, image];
}));

export function tunnelPath(length, bendDegrees, steps = 36) {
  const angle = Math.max(0, Math.min(150, Number(bendDegrees) || 0)) * Math.PI / 180;
  if (angle < .001) return Array.from({ length: steps + 1 }, (_, i) => ({ x: 0, y: (i / steps - .5) * length }));
  const radius = length / angle;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, a = (t - .5) * angle;
    return { x: radius * (Math.cos(a) - Math.cos(angle / 2)), y: radius * Math.sin(a) };
  });
}

export function obstacleFootprint(obstacle) {
  const length = Number(obstacle.length) || 4.5;
  const bend = Math.max(0, Math.min(150, Number(obstacle.bend) || 0)) * Math.PI / 180;
  const footprints = {
    jump: [1.3, .6], wall: [1.2, .4],
    longJump: [1.5, 1.5], tire: [1.1, .4], aFrame: [.9, 5.4], dogWalk: [.3, 10.6],
    seesaw: [.3, 3.7], weave: [6.6, .6],
  };
  if (obstacle.type === 'tunnel') {
    const angle = bend;
    if (angle < .001) return { width: .6, depth: length };
    const radius = length / angle;
    return { width: .6 + 2 * radius * (1 - Math.cos(angle / 2)), depth: 2 * radius * Math.sin(angle / 2) + .6 };
  }
  const [width, depth] = footprints[obstacle.type] || [.8, .8];
  return { width, depth };
}

export function obstacleDistance(a, b, courseLength, courseWidth) {
  return Math.hypot((b.x - a.x) * courseLength, (b.y - a.y) * courseWidth);
}

function paintTunnel(ctx, obstacle) {
  const length = Number(obstacle.length) || 4.5;
  const points = tunnelPath(length, obstacle.bend);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.strokeStyle = '#263832'; ctx.lineWidth = .68; ctx.stroke();
  ctx.strokeStyle = '#1da9b7'; ctx.lineWidth = .53; ctx.stroke();
  ctx.strokeStyle = '#8ee0d3'; ctx.lineWidth = .08; ctx.stroke();
  for (let i = 0; i < points.length; i += Math.max(4, Math.round(points.length / Math.max(3, length * 2)))) {
    const p = points[i];
    ctx.beginPath(); ctx.arc(p.x, p.y, .29, 0, Math.PI * 2);
    ctx.strokeStyle = '#126675'; ctx.lineWidth = .025; ctx.stroke();
  }
  for (const p of [points[0], points.at(-1)]) {
    ctx.beginPath(); ctx.arc(p.x, p.y, .3, 0, Math.PI * 2);
    ctx.fillStyle = '#073f4b'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, .23, 0, Math.PI * 2);
    ctx.fillStyle = '#172722'; ctx.fill();
  }
}

function paintTopDown(ctx, obstacle, width, depth, base) {
  const teal = base || '#2b786a', coral = '#e87360', yellow = '#efbd54', dark = '#31423a';
  const bar = (z, color = yellow, thickness = .045) => { ctx.fillStyle = dark; ctx.fillRect(-width / 2, z - .12, width, .24); ctx.fillStyle = color; ctx.fillRect(-width / 2 + .025, z - thickness / 2, width - .05, thickness); };
  const plank = (z, length, color = teal, w = width) => { ctx.fillStyle = dark; ctx.fillRect(-w / 2, z - length / 2, w, length); ctx.fillStyle = color; ctx.fillRect(-w / 2 + .025, z - length / 2 + .025, w - .05, length - .05); };
  switch (obstacle.type) {
    case 'jump':
      [-width / 2 + .08, width / 2 - .08].forEach(x => { ctx.fillStyle = dark; ctx.fillRect(x - .035, -depth / 2, .07, depth); });
      if (obstacle.type === 'jump') bar(0);
      else { bar(-depth * .34, yellow); bar(depth * .34, coral); }
      break;
    case 'wall': ctx.fillStyle = dark; ctx.fillRect(-width / 2, -depth / 2, width, depth); ctx.fillStyle = '#df8b70'; ctx.fillRect(-width / 2 + .05, -depth / 2 + .04, width - .1, depth - .08); for (let z = -depth / 2 + .13; z < depth / 2; z += .16) { ctx.strokeStyle = '#fff0d8'; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(-width / 2 + .05, z); ctx.lineTo(width / 2 - .05, z); ctx.stroke(); } break;
    case 'longJump': for (let i = 0; i < 4; i++) plank(-depth / 2 + (i + .5) * depth / 4, depth / 5, i % 2 ? yellow : coral, width * (.72 + i * .06)); break;
    case 'tire': ctx.beginPath(); ctx.arc(0, 0, .31, 0, Math.PI * 2); ctx.fillStyle = '#f3e9cd'; ctx.fill(); ctx.strokeStyle = coral; ctx.lineWidth = .12; ctx.stroke(); ctx.fillStyle = dark; ctx.fillRect(-width / 2, -depth / 2, width, .07); ctx.fillRect(-width / 2, depth / 2 - .07, width, .07); break;
    case 'aFrame': plank(0, depth, teal); for (const z of [-depth / 2 + .53, depth / 2 - .53]) plank(z, 1.06, yellow, width * .96); ctx.strokeStyle = '#e5f1d9'; ctx.lineWidth = .025; for (let z = -depth / 2 + .72; z < depth / 2 - .6; z += .25) { ctx.beginPath(); ctx.moveTo(-width / 2, z); ctx.lineTo(width / 2, z); ctx.stroke(); } break;
    case 'dogWalk': plank(0, depth, teal); for (const z of [-depth / 2 + .45, depth / 2 - .45]) plank(z, .9, yellow, width * .96); ctx.strokeStyle = '#e5f1d9'; ctx.lineWidth = .018; for (let z = -depth / 2 + 1.1; z < depth / 2 - .7; z += .28) { ctx.beginPath(); ctx.moveTo(-width / 2, z); ctx.lineTo(width / 2, z); ctx.stroke(); } break;
    case 'seesaw': plank(0, depth, teal); plank(-depth / 2 + .38, .76, yellow, width * .98); plank(depth / 2 - .38, .76, yellow, width * .98); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, .12, 0, Math.PI * 2); ctx.fill(); break;
    case 'weave': for (let i = 0; i < 12; i++) { const x = (i - 5.5) * .6; ctx.beginPath(); ctx.arc(x, 0, .08, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? coral : teal; ctx.fill(); ctx.lineWidth = .025; ctx.strokeStyle = dark; ctx.stroke(); } ctx.strokeStyle = dark; ctx.lineWidth = .035; ctx.beginPath(); ctx.moveTo(-3.3, .13); ctx.lineTo(3.3, .13); ctx.stroke(); break;
    case 'chute': ctx.fillStyle = teal; ctx.beginPath(); ctx.arc(0, -depth / 2 + .35, width / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = coral; ctx.beginPath(); ctx.moveTo(-width / 2, -depth / 2 + .65); ctx.lineTo(width / 2, -depth / 2 + .65); ctx.lineTo(width / 2 * .7, depth / 2); ctx.lineTo(-width / 2 * .7, depth / 2); ctx.closePath(); ctx.fill(); for (let z = -depth / 2 + .8; z < depth / 2; z += .27) { ctx.strokeStyle = '#ffd4be'; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(-width / 2 * .8, z); ctx.lineTo(width / 2 * .8, z); ctx.stroke(); } break;
    default: ctx.fillStyle = base || teal; ctx.fillRect(-width / 2, -depth / 2, width, depth);
  }
}

export function drawObstacle(ctx, canvas, obstacle, selected, state) {
  const x = obstacle.x * canvas.width, y = obstacle.y * canvas.height;
  const toMeters = value => (state.unit === 'ft' ? .3048 : 1) * value;
  const pxX = canvas.width / toMeters(state.length), pxY = canvas.height / toMeters(state.width);
  const { width, depth } = obstacleFootprint(obstacle);
  const label = obstacle.label || names[obstacle.type] || 'Przeszkoda';
  const angle = (Number(obstacle.rotation) || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(pxX, pxY);

  if (selected) {
    ctx.fillStyle = '#f078511c';
    ctx.strokeStyle = '#e56d49'; ctx.lineWidth = .025; ctx.setLineDash([.12, .08]);
    ctx.beginPath(); ctx.rect(-width / 2 - .12, -depth / 2 - .12, width + .24, depth + .24); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  if (obstacle.type === 'tunnel') paintTunnel(ctx, obstacle);
  else paintTopDown(ctx, obstacle, width, depth, state.ob);
  ctx.restore();

  const labelOffset = Math.max(26, depth * pxY / 2 + 12);
  if (state.showNumbers) {
    ctx.beginPath(); ctx.arc(x + width * pxX / 2, y - depth * pxY / 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#284638'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 11px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(obstacle.n, x + width * pxX / 2, y - depth * pxY / 2);
  }
  ctx.fillStyle = '#26352f'; ctx.font = '600 9px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(label.length > 19 ? `${label.slice(0, 18)}…` : label, x, y + labelOffset, Math.max(88, width * pxX + 18));
}

