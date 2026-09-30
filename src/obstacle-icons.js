const iconFiles = {
  jump: 'jump.png', spread: 'spread.png', triple: 'triple.png', wall: 'wall.png',
  longJump: 'long-jump.png', tire: 'tire.png', aFrame: 'a-frame.png',
  dogWalk: 'dog-walk.png', seesaw: 'seesaw.png', tunnel: 'tunnel.png',
  chute: 'chute.png', weave: 'weave.png',
};

const icons = Object.fromEntries(Object.entries(iconFiles).map(([type, file]) => {
  const image = new Image();
  image.src = new URL(`../assets/obstacles/${file}`, import.meta.url);
  image.onload = () => window.dispatchEvent(new Event('agility-icons-ready'));
  return [type, image];
}));
const names = {
  jump: 'Skok pojedynczy', spread: 'Skok podwójny', triple: 'Skok potrójny',
  wall: 'Ściana / panel', longJump: 'Skok w dal', tire: 'Koło', aFrame: 'Palizada A',
  dogWalk: 'Kładka', seesaw: 'Huśtawka', tunnel: 'Tunel', chute: 'Tunel miękki', weave: 'Slalom',
};

export function drawObstacle(ctx, canvas, obstacle, selected, state) {
  const x = obstacle.x * canvas.width;
  const y = obstacle.y * canvas.height;
  const image = icons[obstacle.type];
  const label = obstacle.label || names[obstacle.type] || 'Przeszkoda';

  ctx.save();
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, 51, 0, Math.PI * 2);
    ctx.fillStyle = '#f078511c';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#e56d49';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (image?.complete && image.naturalWidth) {
    const maxWidth = 86, maxHeight = 68;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const rotation = (Number(obstacle.rotation) || 0) * Math.PI / 180;
    const tunnel = ['tunnel', 'chute'].includes(obstacle.type);
    const lengthScale = obstacle.type === 'tunnel'
      ? Math.max(0.62, Math.min(1.42, (Number(obstacle.length) || 4.5) / 4.5))
      : 1;
    ctx.save();
    ctx.translate(x, y - 5);
    ctx.rotate(rotation);
    ctx.scale(tunnel ? lengthScale : 1, 1);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  if (state.showNumbers) {
    ctx.beginPath();
    ctx.arc(x + 36, y - 34, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#284638';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obstacle.n, x + 36, y - 34);
  }

  ctx.fillStyle = '#26352f';
  ctx.font = '600 9px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label.length > 15 ? `${label.slice(0, 14)}…` : label, x, y + 34, 88);
  ctx.restore();
}

