import * as THREE from 'three';
import { obstacleFootprint, obstacleEntrySide } from './obstacle-icons.js?v=agility-number-beside-entry-20261003';

const obstacleColors = {
  jump: '#f2aa42', spread: '#f2aa42', wall: '#ed7863', longJump: '#ef9c4e',
  tire: '#ef7868', aFrame: '#16a6a9', dogWalk: '#16a6a9', seesaw: '#16a6a9', tunnel: '#18aab9', chute: '#ed7863', weave: '#ef7868',
};

export function createScene3D({ canvas, getState, onSelect, onMove, onBend, onRotate, onEditNumber, onDone, onError }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); onError('Utracono kontekst grafiki 3D. Przełącz na 2D i ponów próbę.'); });
  canvas.addEventListener('webglcontextrestored', () => update(getState()));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14201c');
  scene.fog = new THREE.Fog('#14201c', 35, 110);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 300);
  const target = new THREE.Vector3(0, 0, 0);
  let azimuth = .72, elevation = .78, distance = 52;
  const hemi = new THREE.HemisphereLight('#f5ffe9', '#687568', 2.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4d8', 3.2); sun.position.set(-16, 28, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; scene.add(sun);
  const fill = new THREE.DirectionalLight('#8ce1dc', 1.0); fill.position.set(18, 12, -16); scene.add(fill);
  const matCache = new Map();
  const mat = (color, roughness = .72, metalness = 0) => {
    const key = `${color}-${roughness}-${metalness}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return matCache.get(key);
  };
  const floorGroup = new THREE.Group(), obstacleGroup = new THREE.Group(), routeGroup = new THREE.Group();
  scene.add(floorGroup, routeGroup, obstacleGroup);

  function addBox(group, color, x, y, z, w, h, d, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, options.roughness ?? .72, options.metalness ?? 0));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function addCylinder(group, color, x, y, z, radius, height, segments = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat(color, .55));
    mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh;
  }
  function addBar(group, color, z, height = .55, length = 1.2) {
    const postX = length / 2 - .08;
    for (const side of [-1, 1]) {
      const x = side * postX;
      addBox(group, '#26352f', x, .055, z, .34, .11, .3);
      addBox(group, '#e8e1cd', x, .49, z, .075, .88, .085);
      addBox(group, color, x, .76, z + .006, .105, .27, .1);
      for (let mark = 0; mark < 3; mark++) addBox(group, '#f8f2d8', x, .68 + mark * .075, z + .062, .108, .025, .012);
      const brace = addBox(group, '#45584b', side * (postX - .105), .205, z, .32, .055, .065);
      brace.rotation.z = side > 0 ? .78 : Math.PI - .78;
      addBox(group, '#e9c763', x, height - .035, z, .16, .07, .14);
    }
    for (let i = -2; i <= 2; i++) {
      const segmentLength = length / 5;
      addCylinder(group, i % 2 ? '#f8f2d8' : color, i * segmentLength, height, z, .045, segmentLength + .008, 20).rotation.z = Math.PI / 2;
    }
  }
  function addRamp(group, z, sign, width = .9, length = 2.7, height = 1.7, contact = true) {
    const angle = Math.asin(Math.min(.98, height / length));
    const centerZ = z + sign * length * Math.cos(angle) / 2;
    const centerY = Math.max(.12, height - length * Math.sin(angle) / 2);
    const plank = addBox(group, '#16a6a9', 0, centerY, centerZ, width, .09, length);
    plank.rotation.x = sign * angle;
    if (contact) {
      const contactLength = Math.min(1.06, length * .36);
      const endZ = centerZ + sign * (length / 2 - contactLength / 2) * Math.cos(angle);
      const endY = centerY - (length / 2 - contactLength / 2) * Math.sin(angle);
      const zone = addBox(group, '#f1bf55', 0, endY + .03, endZ, width * .98, .035, contactLength);
      zone.rotation.x = sign * angle;
    }
    for (let i = -4; i <= 4; i++) {
      const local = i * .27, rz = centerZ + local * Math.cos(angle), ry = centerY - sign * local * Math.sin(angle) + .065;
      const slat = addBox(group, '#d4eee0', 0, ry, rz, width * .94, .025, .035); slat.rotation.x = sign * angle;
    }
  }
  function makeTunnelCurve(length, bendDegrees) {
    const angle = Math.max(0, Math.min(150, Number(bendDegrees) || 0)) * Math.PI / 180;
    if (angle < .001) return new THREE.CatmullRomCurve3([new THREE.Vector3(0, .32, -length / 2), new THREE.Vector3(0, .32, 0), new THREE.Vector3(0, .32, length / 2)]);
    const radius = length / angle, pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40 - .5) * angle;
      pts.push(new THREE.Vector3(radius * (Math.cos(a) - Math.cos(angle / 2)), .32, radius * Math.sin(a)));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  function obstacleTraversal(s, nodes, index, L, W, beforeOverride, afterOverride) {
    const obstacle = nodes[index];
    const rotation = (Number(obstacle.rotation) || 0) * Math.PI / 180;
    const { depth } = obstacleFootprint(obstacle);
    let localPoints;
    if (obstacle.type === 'tunnel') localPoints = makeTunnelCurve(Math.max(3, Math.min(6, Number(obstacle.length) || 4.5)), obstacle.bend).getPoints(40);
    else if (obstacle.type === 'weave') { const count = Number(obstacle.poleCount) === 6 ? 6 : 12; localPoints = [new THREE.Vector3(-((count - 1) * .3 + .3), .55, 0), ...Array.from({ length: count }, (_, i) => new THREE.Vector3((i - (count - 1) / 2) * .6, .55, i % 2 ? .27 : -.27)), new THREE.Vector3((count - 1) * .3 + .3, .55, 0)]; }
    else {
      const steps = ['aFrame', 'dogWalk', 'seesaw'].includes(obstacle.type) ? 32 : 1;
      localPoints = Array.from({ length: steps + 1 }, (_, i) => {
        const z = (i / steps - .5) * depth, abs = Math.abs(z);
        let y;
        if(obstacle.type==='aFrame'){const height=Math.max(1.2,Math.min(2,Number(obstacle.height)||1.7));y=.08+height*Math.max(0,1-abs/(depth/2))}
        else if(obstacle.type==='dogWalk'){const height=Math.max(.8,Math.min(1.3,Number(obstacle.height)||1.2)),rampLength=3.65,run=Math.sqrt(rampLength**2-height**2),deckHalf=1.825;y=.08+(abs<=deckHalf?height:height*Math.max(0,1-(abs-deckHalf)/run))}
        else y=obstacle.type==='seesaw'?.64-z*Math.sin(.08):obstacle.type==='wall'?.65:obstacle.type==='longJump'?.2:obstacle.type==='tire'?(Number(obstacle.height)||.8):obstacle.type==='tunnel'?.32:obstacle.type==='chute'?.28:obstacle.type==='spread'?.65:.55;
        return new THREE.Vector3(0, y, z);
      });
    }
    const cx = (obstacle.x - .5) * L, cz = (obstacle.y - .5) * W;
    const points = localPoints.map(p => new THREE.Vector3(cx + p.x * Math.cos(rotation) - p.z * Math.sin(rotation), p.y, cz + p.x * Math.sin(rotation) + p.z * Math.cos(rotation)));
    const center = item => new THREE.Vector3((item.x - .5) * L, .32, (item.y - .5) * W);
    const before = beforeOverride || nodes[index - 1], after = afterOverride || nodes[index + 1];
    let enterFromStart = true;
    if (before) enterFromStart = points[0].distanceTo(center(before)) < points.at(-1).distanceTo(center(before));
    else if (after) enterFromStart = points.at(-1).distanceTo(center(after)) < points[0].distanceTo(center(after));
    if (!enterFromStart) points.reverse();
    return { entry: points[0], exit: points.at(-1), points };
  }
  function addTunnel(group, obstacle) {
    const length = Math.max(3, Math.min(6, Number(obstacle.length) || 4.5));
    const curve = makeTunnelCurve(length, obstacle.bend);
    const shell = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, .3, 16, false), mat('#1ba8b8', .46));
    shell.castShadow = true; shell.receiveShadow = true; group.add(shell);
    for (const t of [0, 1]) {
      const point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.3, .035, 10, 32), mat('#ec7762', .5));
      rim.position.copy(point); rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent); rim.castShadow = true; group.add(rim);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(.23, .018, 8, 24), mat('#86dfd6', .45));
      inner.position.copy(point); inner.quaternion.copy(rim.quaternion); group.add(inner);
    }
    for (let t = .12; t < .95; t += .16) {
      const point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(.3, .012, 6, 24), mat('#166879', .62));
      hoop.position.copy(point); hoop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent); group.add(hoop);
    }
  }
  function makeObstacle(obstacle) {
    const g = new THREE.Group(); g.userData.obstacleId = obstacle.id;
    const orange = '#f1a943', teal = '#16a6a9', charcoal = '#273630';
    switch (obstacle.type) {
      case 'jump': addBar(g, orange, 0, .55); break;
      case 'spread': addBar(g, orange, -.24, .5); addBar(g, '#48b9aa', .24, .72, 1.35); break;
      case 'wall':
        addBox(g, charcoal, 0, .31, 0, 1.18, .62, .25);
        for (let y = .16; y < .62; y += .15) addBox(g, y > .42 ? orange : '#e9c18c', 0, y, .14, 1.1, .025, .025);
        break;
      case 'longJump':
        for (let i = 0; i < 4; i++) { const z = -.56 + i * .36, h = .12 + i * .045; addBox(g, i % 2 ? '#f5d27a' : orange, 0, h / 2, z, 1.25, h, .28); }
        for (const x of [-.72, .72]) for (const z of [-.72, .72]) addCylinder(g, '#34453b', x, .52, z, .025, 1.04, 8);
        break;
      case 'tire': {
        const height = Math.max(.4, Math.min(1.2, Number(obstacle.height) || .8));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .055, 12, 40), mat('#ef7868', .45)); ring.position.y = height; ring.castShadow = true; g.add(ring);
        for (const x of [-.4, .4]) { addBox(g, charcoal, x, height / 2, 0, .045, height, .06); addBox(g, charcoal, x, .04, 0, .4, .08, .36); }
        break;
      }
      case 'aFrame': { const height = Math.max(1.2, Math.min(2, Number(obstacle.height) || 1.7)); addRamp(g, 0, -1, .9, 2.7, height); addRamp(g, 0, 1, .9, 2.7, height); break; }
      case 'dogWalk': {
        const height = Math.max(.8, Math.min(1.3, Number(obstacle.height) || 1.2)), rampLength = 3.65;
        const rampAngle = Math.asin(height / rampLength), horizontal = rampLength * Math.cos(rampAngle), deckHalf = 3.65 / 2;
        addBox(g, teal, 0, height, 0, .3, .1, 3.65);
        for (const sign of [-1, 1]) {
          const rampCenterZ = sign * (deckHalf + horizontal / 2), rampCenterY = height / 2;
          const ramp = addBox(g, teal, 0, rampCenterY, rampCenterZ, .3, .09, rampLength); ramp.rotation.x = sign * rampAngle;
          const contactLength = .9, contact = addBox(g, '#f1bf55', 0, contactLength * Math.sin(rampAngle) / 2 + .02, sign * (deckHalf + horizontal - contactLength * Math.cos(rampAngle) / 2), .3, .035, contactLength); contact.rotation.x = sign * rampAngle;
          for (let i = 0; i < 10; i++) {
            const along = .22 + i * .3, z = sign * (deckHalf + along * Math.cos(rampAngle)), y = height - along * Math.sin(rampAngle);
            const slat = addBox(g, '#d4eee0', 0, y + .05, z, .29, .025, .035); slat.rotation.x = sign * rampAngle;
          }
        }
        for (const sign of [-1, 1]) addBox(g, charcoal, 0, height / 2, sign * 1.15, .5, height - .1, .05);
        break;
      }
      case 'seesaw': {
        const tilt = .08;
        const plank = addBox(g, teal, 0, .6, 0, .3, .08, 3.7); plank.rotation.x = tilt;
        // A central pivot at 60 cm supports the plank without poking through it.
        addBox(g, '#e9a749', 0, .28, 0, .14, .56, .18);
        addCylinder(g, '#34453b', 0, .6, 0, .07, .38, 20).rotation.z = Math.PI / 2;
        for (const sign of [-1, 1]) {
          const z = sign * 1.45, y = .6 - z * Math.sin(tilt);
          const contact = addBox(g, '#f1bf55', 0, y, z, .3, .035, .75); contact.rotation.x = tilt;
        }
        break;
      }
      case 'tunnel': addTunnel(g, obstacle); break;
      case 'chute': {
        addCylinder(g, teal, 0, .32, -.77, .32, .7, 28).rotation.x = Math.PI / 2;
        addBox(g, '#ed7863', 0, .28, .62, .62, .5, 2.1);
        for (let i = 0; i < 7; i++) addBox(g, '#d95e5b', 0, .28, -.2 + i * .25, .63, .51, .018);
        break;
      }
      case 'weave':
        { const count = Number(obstacle.poleCount) === 6 ? 6 : 12;
        for (let i = 0; i < count; i++) {
          const x = (i - (count - 1) / 2) * .6;
          addCylinder(g, i % 2 ? '#ef7868' : teal, x, .55, 0, .035, 1.1, 10);
          addCylinder(g, charcoal, x, .025, 0, .11, .05, 12);
        }
        addBox(g, charcoal, 0, .025, 0, (count - 1) * .6, .04, .07); }
        break;
      default: addBox(g, obstacleColors[obstacle.type] || orange, 0, .4, 0, .8, .8, .8);
    }
    g.rotation.y = -(Number(obstacle.rotation) || 0) * Math.PI / 180;
    const pos = createObstacleBadge(g, obstacle);
    g.userData.badge = pos;
    g.userData.badgeSignature = obstacleBadgeSignature(obstacle);
    g.userData.geometrySignature = `${obstacle.type}|${obstacle.length || ''}|${obstacle.bend || ''}|${obstacle.height || ''}|${obstacle.poleCount || ''}`;
    g.traverse(obj => { if (obj.isMesh) { obj.userData.obstacleId = obstacle.id; obj.castShadow = true; } });
    return g;
  }
  function obstacleVisitCount(obstacle,s=getState()){const route=Array.isArray(s.route)?s.route:[],count=route.filter(visit=>(typeof visit==='string'?visit:visit?.obstacleId)===obstacle.id).length;return Math.max(1,count)}
  function obstacleBadgeSignature(obstacle){return `${obstacle.n}|${obstacle.label||''}|${obstacleVisitCount(obstacle)}`}
  function createObstacleBadge(group, obstacle) {
    const badges=new THREE.Group(),count=obstacleVisitCount(obstacle),height=Number(obstacle.height)||(obstacle.type==='dogWalk'?1.2:1.7),entrySide=obstacleEntrySide(obstacle,getState()),depth=obstacleFootprint(obstacle).depth;
    for(let i=0;i<count;i++){const badge=createLabel(`${obstacle.n}${obstacle.label?` · ${obstacle.label}`:''}`, '#fff8e8', '#234238');badge.userData.obstacleId=obstacle.id;badge.userData.numberBadge=true;badge.position.x=(i-(count-1)/2)*.52;badge.scale.set(1.45,.34,1);badges.add(badge)}
    badges.position.y=obstacle.type==='aFrame'?height+.42:obstacle.type==='dogWalk'?height+.42:1.3;badges.position.z=entrySide*(depth/2+.62);group.add(badges);return badges;
  }
  function createLabel(text, foreground = '#f3f7ee', background = '#1b2b25') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = background; x.beginPath(); x.roundRect(8, 15, 496, 98, 28); x.fill();
    x.fillStyle = foreground; x.font = 'bold 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 64, 470);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); sprite.renderOrder = 3; return sprite;
  }
  function clearGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse?.(obj => { obj.geometry?.dispose?.(); if (obj.material?.map) obj.material.map.dispose(); if (obj.material && !Array.isArray(obj.material) && !matCacheHas(obj.material)) obj.material.dispose(); });
    }
  }
  function matCacheHas(material) { return [...matCache.values()].includes(material); }
  function buildFloor(s) {
    clearGroup(floorGroup);
    const unitScale = s.unit === 'ft' ? .3048 : 1, L = (Number(s.length) || 40) * unitScale, W = (Number(s.width) || 24) * unitScale;
    addBox(floorGroup, '#24342c', 0, -.18, 0, L + 1.1, .36, W + 1.1);
    addBox(floorGroup, '#b5c39d', 0, .005, 0, L, .04, W);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, .045, W)), new THREE.LineBasicMaterial({ color: '#55694b' }));
    outline.position.y = .04; floorGroup.add(outline);
    if (s.grid) {
      const points = [], step = Math.max(.5, (Number(s.gridSize) || 2) * (s.unit === 'ft' ? .3048 : 1));
      for (let x = -L / 2; x <= L / 2 + .001; x += step) { points.push(new THREE.Vector3(x, .032, -W / 2), new THREE.Vector3(x, .032, W / 2)); }
      for (let z = -W / 2; z <= W / 2 + .001; z += step) { points.push(new THREE.Vector3(-L / 2, .032, z), new THREE.Vector3(L / 2, .032, z)); }
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      floorGroup.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#697960', transparent: true, opacity: .28 })));
      const labelStep=step*Math.max(1,Math.ceil(Math.max(L,W)/16/step));
      for(let x=0;x<=L+.001;x+=labelStep){const label=createLabel(`${x.toFixed(1).replace('.',',')} m`,'#eef4e8','#34483b');label.position.set(-L/2+x,.07,W/2-.15);label.scale.set(.72,.18,1);floorGroup.add(label)}
      for(let z=0;z<=W+.001;z+=labelStep){const label=createLabel(`${z.toFixed(1).replace('.',',')} m`,'#eef4e8','#34483b');label.position.set(-L/2+.2,.07,W/2-z);label.scale.set(.72,.18,1);floorGroup.add(label)}
    }
    floorGroup.userData.signature = `${L}|${W}|${s.grid}|${s.gridSize}|${s.unit}`;
    const radius = Math.hypot(L, W) * 1.4;
    target.set(0, .3, 0); distance = Math.max(25, radius);
    sun.shadow.camera.left = -L; sun.shadow.camera.right = L; sun.shadow.camera.top = W; sun.shadow.camera.bottom = -W; sun.shadow.camera.updateProjectionMatrix();
    camera.far = radius * 5; camera.updateProjectionMatrix();
  }
  function buildRoute(s) {
    clearGroup(routeGroup);
    const byId=new Map(s.obstacles.map(o=>[o.id,o])),visits=Array.isArray(s.route)?s.route.map(visit=>typeof visit==='string'?visit:visit?.obstacleId).filter(key=>byId.has(key)):[];
    const ordered = visits.length?visits.map(key=>byId.get(key)):[...s.obstacles].sort((a, b) => a.n - b.n);
    const groups=[];for(let i=0;i<ordered.length;i++){const o=ordered[i],last=groups.at(-1);if(last&&Number(last[0].o.n)===Number(o.n)&&last.some(item=>item.o.id!==o.id))last.push({o,index:i});else groups.push([{o,index:i}])}const links=[];for(let i=0;i<groups.length-1;i++)for(const aa of groups[i])for(const bb of groups[i+1])links.push({ai:aa.index,bi:bb.index,a:aa.o,b:bb.o,prev:groups[i-1]?.[0].o||aa.o,next:groups[i+2]?.[0].o||bb.o});
    if ((s.showRoute || s.showDistances) && ordered.length > 1) {
      for (const {ai,bi,a,b,prev,next} of links) {
        const unitScale = s.unit === 'ft' ? .3048 : 1, L = s.length * unitScale, W = s.width * unitScale;
        const ta = obstacleTraversal(s, ordered, ai, L, W, prev, b);
        const tb = obstacleTraversal(s, ordered, bi, L, W, a, next);
        const p0 = ta ? ta.exit.clone() : new THREE.Vector3((a.x - .5) * L, .08, (a.y - .5) * W);
        const p3 = tb ? tb.entry.clone() : new THREE.Vector3((b.x - .5) * L, .08, (b.y - .5) * W);
        const pp = new THREE.Vector3((prev.x - .5) * L, .08, (prev.y - .5) * W);
        const pn = new THREE.Vector3((next.x - .5) * L, .08, (next.y - .5) * W);
        const delta = new THREE.Vector3().subVectors(p3, p0), len = Math.max(.01, delta.length());
        const normal = new THREE.Vector3(delta.z, 0, -delta.x).normalize();
        const offset = (s.routeBends?.[`${a.id}:${b.id}`] || 0) * Math.min(L, W);
        const align = len * .2, ra = (Number(a.rotation) || 0) * Math.PI / 180, rb = (Number(b.rotation) || 0) * Math.PI / 180;
        const startTangent = ta && ta.exit.clone().sub(ta.points.at(-2)).normalize(), endTangent = tb && tb.points[1].clone().sub(tb.entry).normalize();
        const c1 = p0.clone().add(startTangent ? startTangent.multiplyScalar(align) : new THREE.Vector3(p3.x - pp.x, 0, p3.z - pp.z).multiplyScalar(.18).add(new THREE.Vector3(Math.cos(ra) * align, 0, Math.sin(ra) * align))).add(normal.clone().multiplyScalar(offset));
        const c2 = p3.clone().sub(endTangent ? endTangent.multiplyScalar(align) : new THREE.Vector3(pn.x - p0.x, 0, pn.z - p0.z).multiplyScalar(.18).add(new THREE.Vector3(Math.cos(rb) * align, 0, Math.sin(rb) * align))).add(normal.clone().multiplyScalar(offset));
        const curve = new THREE.CubicBezierCurve3(p0, c1, c2, p3);
        if (s.showRoute) {
          const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .035, 6, false), mat(s.path || '#f07851', .48));
          line.userData.routeKey = `${a.id}:${b.id}`; line.userData.routeNormal = normal; routeGroup.add(line);
          if (tb) {
            const inside = new THREE.CatmullRomCurve3(tb.points);
            const tunnelLine = new THREE.Mesh(new THREE.TubeGeometry(inside, 40, .035, 6, false), mat(s.path || '#f07851', .48));
            tunnelLine.material.depthTest = false; tunnelLine.renderOrder = 5;
            tunnelLine.userData.routeKey = `${a.id}:${b.id}`; tunnelLine.userData.routeNormal = normal; routeGroup.add(tunnelLine);
          }
        }
        if (s.showDistances) {
          const samples = curve.getPoints(40);
          let meters = 0;
          for (let j = 1; j < samples.length; j++) meters += samples[j].distanceTo(samples[j - 1]);
          const amount = s.unit === 'ft' ? meters / .3048 : meters;
          const measurement = new THREE.BufferGeometry().setFromPoints(samples);
          const measureLine = new THREE.Line(measurement, new THREE.LineDashedMaterial({ color: '#63d4bf', dashSize: .28, gapSize: .18, transparent: true, opacity: .88 }));
          measureLine.computeLineDistances(); routeGroup.add(measureLine);
          const mid = curve.getPoint(.5), label = createLabel(String(amount.toFixed(1)) + ' ' + s.unit, '#fff5c6', '#28433b');
          label.position.set(mid.x, mid.y + .62, mid.z); label.scale.set(1.1, .28, 1); routeGroup.add(label);
        }
      }
      if (s.showRoute && ordered.length) {
        for(const item of groups[0]){const first=obstacleTraversal(s,ordered,item.index,s.length*(s.unit==='ft'?.3048:1),s.width*(s.unit==='ft'?.3048:1),null,groups[1]?.[0].o),inside=new THREE.CatmullRomCurve3(first.points),line=new THREE.Mesh(new THREE.TubeGeometry(inside,Math.max(8,first.points.length*2),.035,6,false),mat(s.path||'#f07851',.48));line.material.depthTest=false;line.renderOrder=5;routeGroup.add(line)}
      }
    }
  }
  function update(s) {
    const unitScale = s.unit === 'ft' ? .3048 : 1;
    const signature = `${(Number(s.length) || 40) * unitScale}|${(Number(s.width) || 24) * unitScale}|${s.grid}|${s.gridSize}|${s.unit}`;
    if (floorGroup.userData.signature !== signature) buildFloor(s);
    const L = (Number(s.length) || 40) * unitScale, W = (Number(s.width) || 24) * unitScale;
    const liveIds = new Set();
    for (const obstacle of s.obstacles) {
      liveIds.add(obstacle.id);
      let g = obstacleGroup.children.find(child => child.userData.obstacleId === obstacle.id);
      const geometrySignature = `${obstacle.type}|${obstacle.length || ''}|${obstacle.bend || ''}|${obstacle.height || ''}|${obstacle.poleCount || ''}`;
      if (!g || g.userData.geometrySignature !== geometrySignature) {
        if (g) { obstacleGroup.remove(g); disposeObject(g); }
        g = makeObstacle(obstacle); obstacleGroup.add(g);
      } else if (g.userData.badgeSignature !== obstacleBadgeSignature(obstacle)) {
        g.remove(g.userData.badge); g.userData.badge?.traverse?.(item=>{item.material?.map?.dispose?.();item.material?.dispose?.()});
        g.userData.badge = createObstacleBadge(g, obstacle); g.userData.badgeSignature = obstacleBadgeSignature(obstacle);
      }
      g.userData.badge.visible = !!s.showNumbers;
      g.position.set((obstacle.x - .5) * L, .045, (obstacle.y - .5) * W);
      g.rotation.y = -(Number(obstacle.rotation) || 0) * Math.PI / 180;
    }
    for (const child of [...obstacleGroup.children]) if (!liveIds.has(child.userData.obstacleId)) { obstacleGroup.remove(child); disposeObject(child); }
    buildRoute(s);
    camera.position.set(target.x + Math.sin(azimuth) * Math.cos(elevation) * distance, target.y + Math.sin(elevation) * distance, target.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.lookAt(target);
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) { renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
  }
  function disposeObject(object) {
    object.traverse(obj => { obj.geometry?.dispose?.(); if (obj.material?.map) obj.material.map.dispose(); if (obj.material && !Array.isArray(obj.material) && !matCacheHas(obj.material)) obj.material.dispose(); });
  }
  function ray(e) {
    const r = canvas.getBoundingClientRect(); pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    caster.setFromCamera(pointer, camera);
  }
  const caster = new THREE.Raycaster(), pointer = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let action = null, last = null, wheelTimeout;
  canvas.addEventListener('pointerdown', e => {
    ray(e);
    const intersections=caster.intersectObjects(obstacleGroup.children,true),badgeHit=intersections.find(h=>h.object.userData.numberBadge);
    if(badgeHit&&getState().showNumbers){const id=badgeHit.object.userData.obstacleId;onSelect(id);onEditNumber?.(id);e.preventDefault();return}
    if (getState().tool === 'route') {
      caster.params.Line = { threshold: .18 };
      const hits = caster.intersectObjects(routeGroup.children, true).filter(h => h.object.userData.routeKey);
      if (hits.length) {
        const obj = hits[0].object, point = hits[0].point, normal = obj.userData.routeNormal;
        action = { type: 'bend', key: obj.userData.routeKey, normal, start: point, initial: getState().routeBends?.[obj.userData.routeKey] || 0 };
        canvas.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
    }
    const hits = intersections.filter(h => h.object.userData.obstacleId);
    if (hits.length) {
      const hit = hits[0], id = hit.object.userData.obstacleId;
      onSelect(id);
      if(e.altKey){const obstacle=getState().obstacles.find(item=>item.id===id);action={type:'rotate',id,startX:e.clientX,initial:Number(obstacle?.rotation)||0};canvas.setPointerCapture(e.pointerId);e.preventDefault();return}
      const point = new THREE.Vector3(); caster.ray.intersectPlane(ground, point);
      action = { type: 'move', id, offset: obstacleGroup.children.find(g => g.userData.obstacleId === id).position.clone().sub(point), moved: false };
      canvas.setPointerCapture(e.pointerId); e.preventDefault();
    } else {
      const navigate = e.shiftKey || e.button === 1 || e.button === 2;
      action = { type: navigate ? 'pan' : 'orbit' }; last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId); e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!action) return;
    if (action.type === 'orbit') {
      azimuth -= (e.clientX - last.x) * .006; elevation = Math.max(.18, Math.min(1.42, elevation + (e.clientY - last.y) * .005)); last = { x: e.clientX, y: e.clientY }; update(getState());
    } else if (action.type === 'pan') {
      const rect = canvas.getBoundingClientRect(), scale = distance / Math.max(1, rect.height);
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
      const screenUp = new THREE.Vector3(-Math.sin(azimuth) * Math.sin(elevation), 0, -Math.cos(azimuth) * Math.sin(elevation));
      target.addScaledVector(right, -dx * scale).addScaledVector(screenUp, dy * scale);
      last = { x: e.clientX, y: e.clientY }; update(getState());
    } else if (action.type === 'move') {
      ray(e); const point = new THREE.Vector3(); if (!caster.ray.intersectPlane(ground, point)) return;
      const x = point.x + action.offset.x, z = point.z + action.offset.z, s = getState();
      const g = obstacleGroup.children.find(v => v.userData.obstacleId === action.id); if (g) g.position.set(x, .045, z);
      const unitScale = s.unit === 'ft' ? .3048 : 1;
      action.moved = true; onMove(action.id, Math.max(0, Math.min(1, x / (s.length * unitScale) + .5)), Math.max(0, Math.min(1, z / (s.width * unitScale) + .5)));
    } else if (action.type === 'rotate') {
      const rotation=action.initial+(e.clientX-action.startX)*.7;
      onRotate?.(action.id,((rotation+180)%360+360)%360-180);
    } else if (action.type === 'bend') {
      ray(e); const point = new THREE.Vector3(); if (!caster.ray.intersectPlane(ground, point)) return;
      const delta = point.sub(action.start).dot(action.normal), s = getState();
      const unitScale = s.unit === 'ft' ? .3048 : 1;
      onBend(action.key, Math.max(-.28, Math.min(.28, action.initial + delta / Math.min(s.length * unitScale, s.width * unitScale))));
    }
  });
  const finish = () => { if (action?.type === 'move' && action.moved) onDone(); if (action?.type === 'bend'||action?.type==='rotate') onDone(); action = null; last = null; };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { distance = Math.max(10, Math.min(130, distance * (e.deltaY > 0 ? 1.08 : .92))); update(getState()); clearTimeout(wheelTimeout); wheelTimeout = setTimeout(onDone, 400); e.preventDefault(); }, { passive: false });
  const observer = new ResizeObserver(() => update(getState())); observer.observe(canvas.parentElement);
  return { update, renderer, dispose() { observer.disconnect(); clearGroup(obstacleGroup); clearGroup(routeGroup); clearGroup(floorGroup); renderer.dispose(); } };
}

