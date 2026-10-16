import * as THREE from 'three';
import { obstacleFootprint, obstacleEntrySide } from './obstacle-icons.js?v=agility-number-drag-20261016';

const obstacleColors = {
  jump: '#f2aa42', spread: '#f2aa42', wall: '#ed7863', longJump: '#ef9c4e',
  tire: '#ef7868', aFrame: '#16a6a9', dogWalk: '#16a6a9', seesaw: '#16a6a9', tunnel: '#18aab9', chute: '#ed7863', weave: '#ef7868',
};

export function createScene3D({ canvas, getState, onSelect, onMove, onBend, onRotate, onEditNumber, onMoveNumber, onEditMarker, onAddMarker, onDone, onError }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); onError('Utracono kontekst grafiki 3D. Przełącz na 2D i ponów próbę.'); });
  canvas.addEventListener('webglcontextrestored', () => update(getState()));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#78abd0');
  scene.fog = new THREE.Fog('#a9c8d5', 75, 230);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 300);
  let viewportWidth = 0, viewportHeight = 0;
  const target = new THREE.Vector3(0, 0, 0);
  let azimuth = .72, elevation = .78, distance = 52;
  const hemi = new THREE.HemisphereLight('#f5ffe9', '#687568', 2.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4d8', 3.2); sun.position.set(-16, 28, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; scene.add(sun);
  const fill = new THREE.DirectionalLight('#8ce1dc', 1.0); fill.position.set(18, 12, -16); scene.add(fill);
  const matCache = new Map();
  let routeBuildSignature = '', markerBuildSignature = '';
  const mat = (color, roughness = .72, metalness = 0) => {
    const key = `${color}-${roughness}-${metalness}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return matCache.get(key);
  };
  const floorGroup = new THREE.Group(), obstacleGroup = new THREE.Group(), routeGroup = new THREE.Group(), markerGroup = new THREE.Group();
  scene.add(floorGroup, routeGroup, obstacleGroup, markerGroup);
  const forestGroup = new THREE.Group(); scene.add(forestGroup);
  let forestAnimals=[],animalAnimationTimer=null;

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
  function weaveTraversalShape(count){const half=(count-1)*.3,amplitude=.42,start=-half-.9,end=half+.9,points=[];for(let x=start;x<=end+.001;x+=.075){let y;if(x< -half){const t=Math.max(0,Math.min(1,(x-start)/.9));y=amplitude*(1-Math.cos(Math.PI*t))/2}else if(x>half){const t=Math.max(0,Math.min(1,(x-half)/.9));y=amplitude*(1+Math.cos(Math.PI*t))/2}else y=amplitude*Math.cos(Math.PI*(x+half)/.6);points.push({x,y})}if(Math.abs(points.at(-1).x-end)>.001)points.push({x:end,y:0});return points}
  function obstacleTraversal(s, nodes, index, L, W, beforeOverride, afterOverride) {
    const obstacle = nodes[index];
    const rotation = (Number(obstacle.rotation) || 0) * Math.PI / 180;
    const { depth } = obstacleFootprint(obstacle);
    let localPoints;
    if (obstacle.type === 'tunnel') localPoints = makeTunnelCurve(Math.max(3, Math.min(6, Number(obstacle.length) || 4.5)), obstacle.bend).getPoints(40);
    else if (obstacle.type === 'weave') { const count=Number(obstacle.poleCount)===6?6:12;localPoints=weaveTraversalShape(count).map(point=>new THREE.Vector3(point.x,.55,point.y)); }
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
    if (obstacle._reverse) points.reverse();
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
  function makeObstacle(obstacle,courseState=getState()) {
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
    const pos = createObstacleBadge(g, obstacle,courseState);
    g.userData.badge = pos;
    g.userData.badgeSignature = obstacleBadgeSignature(obstacle,courseState);
    g.userData.geometrySignature = `${obstacle.type}|${obstacle.length || ''}|${obstacle.bend || ''}|${obstacle.height || ''}|${obstacle.poleCount || ''}`;
    g.traverse(obj => { if (obj.isMesh) { obj.userData.obstacleId = obstacle.id; obj.castShadow = true; } });
    return g;
  }
  function obstacleVisitCount(obstacle,s=getState()){const route=Array.isArray(s.route)?s.route:[],count=route.filter(visit=>(typeof visit==='string'?visit:visit?.obstacleId)===obstacle.id).length;return Math.max(1,count)}
  function obstacleBadgeSignature(obstacle,s=getState()){const route=Array.isArray(s.route)?s.route:[],badges=route.map((visit,index)=>({visit,index})).filter(item=>(typeof item.visit==='string'?item.visit:item.visit?.obstacleId)===obstacle.id).map(item=>[Number.isInteger(item.visit?.n)?item.visit.n:obstacle.n,item.visit?.numberPosition||'',item.visit?.numberOffset?.x||0,item.visit?.numberOffset?.y||0]);return `${obstacle.n}|${obstacle.label||''}|${JSON.stringify(badges)}`}
  function createObstacleBadge(group, obstacle, s=getState()) {
    const badges=new THREE.Group(),route=Array.isArray(s.route)?s.route:[],visits=route.map((visit,index)=>({visit,index})).filter(item=>(typeof item.visit==='string'?item.visit:item.visit?.obstacleId)===obstacle.id),items=visits.length?visits:[{visit:null,index:null}],height=Number(obstacle.height)||(obstacle.type==='dogWalk'?1.2:1.7),depth=obstacleFootprint(obstacle).depth;
    for(let i=0;i<items.length;i++){const {visit,index}=items[i],number=Number.isInteger(visit?.n)?visit.n:obstacle.n,badge=createLabel(`${number}${obstacle.label?` · ${obstacle.label}`:''}`, '#fff8e8', '#234238');badge.userData.obstacleId=obstacle.id;badge.userData.visitIndex=index;badge.userData.numberBadge=true;badge.userData.courseId=s.activeCourseId;const spread=(i-(items.length-1)/2)*.52,offset=depth/2+1.05,vertical=visit?.numberPosition,rotation=-(Number(obstacle.rotation)||0)*Math.PI/180,verticalSign=vertical==='top'?-1:1,numberOffset=visit?.numberOffset,unitScale=s.unit==='ft'?.3048:1,worldDx=(Number(numberOffset?.x)||0)*s.length*unitScale,worldDz=(Number(numberOffset?.y)||0)*s.width*unitScale,localDx=Math.cos(-rotation)*worldDx+Math.sin(-rotation)*worldDz,localDz=-Math.sin(-rotation)*worldDx+Math.cos(-rotation)*worldDz;badge.position.x=spread+(vertical?-Math.sin(rotation)*verticalSign*offset:0)+localDx;badge.position.z=(vertical?Math.cos(rotation)*verticalSign*offset:obstacleEntrySide(obstacle,s,index)*(visit?.reverse===true?-1:1)*offset)+localDz;badge.scale.set(1.45,.34,1);badges.add(badge)}
    badges.position.y=obstacle.type==='aFrame'?height+.42:obstacle.type==='dogWalk'?height+.42:1.3;group.add(badges);return badges;
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
  function buildForest(s,L,W) {
    clearGroup(forestGroup);
    const skyRadius=Math.hypot(L,W)*2.6+100,skyGeometry=new THREE.SphereGeometry(skyRadius,48,32),positions=skyGeometry.attributes.position,skyColors=[];
    const horizon=new THREE.Color('#a9d0e5'),zenith=new THREE.Color('#4383bd'),earth=new THREE.Color('#294d36');
    for(let i=0;i<positions.count;i++){const t=Math.max(-1,Math.min(1,positions.getY(i)/skyRadius));let color;if(t>=.04)color=horizon.clone().lerp(zenith,Math.min(1,(t-.04)/.96));else if(t>=-.08)color=earth.clone().lerp(horizon,(t+.08)/.12);else color=earth.clone().multiplyScalar(.82);skyColors.push(color.r,color.g,color.b)}
    skyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
    const sky=new THREE.Mesh(skyGeometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false}));sky.renderOrder=-100;forestGroup.add(sky);
    const sunDirection=new THREE.Vector3(-.48,.62,.62).normalize(),sunPosition=sunDirection.clone().multiplyScalar(skyRadius*.82),sunDisk=new THREE.Mesh(new THREE.SphereGeometry(skyRadius*.021,24,16),new THREE.MeshBasicMaterial({color:'#fff0b8',fog:false}));
    sunDisk.position.copy(sunPosition);sunDisk.renderOrder=-90;forestGroup.add(sunDisk);
    const sunGlow=new THREE.Mesh(new THREE.SphereGeometry(skyRadius*.038,20,12),new THREE.MeshBasicMaterial({color:'#ffd879',transparent:true,opacity:.22,depthWrite:false,depthTest:false,fog:false}));
    sunGlow.position.copy(sunPosition);sunGlow.renderOrder=-95;forestGroup.add(sunGlow);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(L+64,W+64),mat('#294d36',.98));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.405;ground.receiveShadow=true;forestGroup.add(ground);
    let seed=Math.floor(L*1301+W*7919)>>>0;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    const seatLength=Math.min(18,Math.max(8,W*.72)),treePositions=[];
    for(const margin of [7,16]){
      const spacing=8,countX=Math.max(2,Math.ceil(L/spacing)),countZ=Math.max(2,Math.ceil(W/spacing));
      for(let i=0;i<countX;i++){const x=-L/2+(i+.5)*L/countX+(random()-.5)*2;treePositions.push([x,W/2+margin+(random()-.5)*2],[x,-W/2-margin+(random()-.5)*2])}
      for(let i=0;i<countZ;i++){const z=-W/2+(i+.5)*W/countZ+(random()-.5)*2;if(!(margin===7&&Math.abs(z)<seatLength/2+2))treePositions.push([L/2+margin+(random()-.5)*2,z]);treePositions.push([-L/2-margin+(random()-.5)*2,z])}
    }
    const temp=new THREE.Object3D(),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.22,1,6),mat('#62472f'),treePositions.length),
      pine=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1.2,10),mat('#2c5c3d'),treePositions.length*5),
      broadleaf=new THREE.InstancedMesh(new THREE.SphereGeometry(1,14,10),mat('#47764b'),treePositions.length*5);
    let pineIndex=0,canopyIndex=0;
    treePositions.forEach(([x,z],i)=>{
      const height=4.4+random()*3.5,isBroadleaf=i%3===0;
      temp.position.set(x,-.4+height/2,z);temp.scale.set(1,height,1);temp.rotation.set(0,random()*Math.PI,0);temp.updateMatrix();trunks.setMatrixAt(i,temp.matrix);
      trunks.setColorAt(i,new THREE.Color(isBroadleaf?'#705037':'#62472f'));
      const radius=1.35+random()*.8;
      if(isBroadleaf){
        for(let cluster=0;cluster<5;cluster++){
          const center=cluster===4,angle=cluster*Math.PI/2+random()*.5,spread=center?0:radius*.34,clusterSize=center?radius*.68:radius*(.48+random()*.18);
          temp.position.set(x+Math.cos(angle)*spread,-.4+height*.7+(random()-.5)*.5,z+Math.sin(angle)*spread);
          temp.scale.set(clusterSize,clusterSize*.82,clusterSize);temp.rotation.set(0,random()*Math.PI,0);temp.updateMatrix();broadleaf.setMatrixAt(canopyIndex,temp.matrix);
          broadleaf.setColorAt(canopyIndex,new THREE.Color(['#3b7547','#4d854c','#5b8b4e'][Math.floor(random()*3)]));canopyIndex++;
        }
      }else{
        for(let layer=0;layer<5;layer++){
          const layerHeight=height*(.34+layer*.1),size=radius*(1-layer*.105);
          temp.position.set(x,-.4+layerHeight,z);temp.scale.set(size,height*.34,size);temp.rotation.set(0,random()*Math.PI,0);temp.updateMatrix();pine.setMatrixAt(pineIndex,temp.matrix);
          pine.setColorAt(pineIndex,new THREE.Color(['#244d35','#306442','#3b7248'][Math.floor(random()*3)]));pineIndex++;
        }
      }
    });
    trunks.instanceMatrix.needsUpdate=true;trunks.castShadow=true;forestGroup.add(trunks);
    pine.count=pineIndex;pine.instanceMatrix.needsUpdate=true;pine.castShadow=true;forestGroup.add(pine);
    broadleaf.count=canopyIndex;broadleaf.instanceMatrix.needsUpdate=true;broadleaf.castShadow=true;forestGroup.add(broadleaf);
    const bushGeo=new THREE.IcosahedronGeometry(1,1),bushes=new THREE.InstancedMesh(bushGeo,mat('#47764b'),56);
    for(let i=0;i<56;i++){
      const edgeX=L/2+2.2,edgeZ=W/2+2.2;let x,z;
      if(i%4===0){x=(random()-.5)*L;z=(random()<.5?-1:1)*edgeZ}
      else if(i%4===1){z=(random()-.5)*W;x=(random()<.5?-1:1)*edgeX}
      else{x=(random()-.5)*(L+4);z=(random()-.5)*(W+4);if(Math.abs(x)<L/2+.7&&Math.abs(z)<W/2+.7)x=Math.sign(x||1)*edgeX}
      const size=.35+random()*.45;temp.position.set(x,-.15,z);temp.scale.set(size,size*.7,size);temp.rotation.set(0,random()*Math.PI,0);temp.updateMatrix();bushes.setMatrixAt(i,temp.matrix);bushes.setColorAt(i,new THREE.Color(['#47764b','#587f4e','#376541'][i%3]));
    }
    bushes.instanceMatrix.needsUpdate=true;bushes.castShadow=true;forestGroup.add(bushes);
    const grassGeo=new THREE.ConeGeometry(1,.62,4),grass=new THREE.InstancedMesh(grassGeo,mat('#62904d'),240);
    const grassMats=['#527e45','#6a9c51','#85a858'];
    for(let i=0;i<80;i++){
      const side=Math.floor(random()*4),along=(random()-.5)*(side<2?L:W),margin=1.25+random()*3.5,cx=side<2?along:(side===2?L/2+margin:-L/2-margin),cz=side===0?W/2+margin:side===1?-W/2-margin:along;
      for(let blade=0;blade<3;blade++){
        const x=cx+(random()-.5)*.35,z=cz+(random()-.5)*.35,size=.26+random()*.22;
        temp.position.set(x,-.4+size*.5,z);temp.scale.set(size*.58,size,size*.58);temp.rotation.set(0,random()*Math.PI,0);temp.updateMatrix();grass.setMatrixAt(i*3+blade,temp.matrix);
        grass.setColorAt(i*3+blade,new THREE.Color(grassMats[Math.floor(random()*grassMats.length)]));
      }
    }
    grass.instanceMatrix.needsUpdate=true;forestGroup.add(grass);
    const flowerGeo=new THREE.SphereGeometry(1,7,5),petals=new THREE.InstancedMesh(flowerGeo,mat('#f4d67b'),180),centers=new THREE.InstancedMesh(flowerGeo,mat('#f4c342'),36),flowerColors=['#f2d36d','#ee9bb4','#eee8da','#bf9ce5'];
    for(let i=0;i<36;i++){
      const side=i%4,along=(random()-.5)*(side<2?L:W),margin=2+random()*3,cx=side<2?along:(side===2?L/2+margin:-L/2-margin),cz=side===0?W/2+margin:side===1?-W/2-margin:along,color=new THREE.Color(flowerColors[i%flowerColors.length]),flowerSize=.07+random()*.035;
      for(let petal=0;petal<5;petal++){
        const angle=petal*Math.PI*2/5,x=cx+Math.cos(angle)*.11,z=cz+Math.sin(angle)*.11;
        temp.position.set(x,-.32,z);temp.scale.set(flowerSize,flowerSize*.55,flowerSize);temp.rotation.set(0,angle,0);temp.updateMatrix();petals.setMatrixAt(i*5+petal,temp.matrix);petals.setColorAt(i*5+petal,color);
      }
      temp.position.set(cx,-.31,cz);temp.scale.set(flowerSize*.55,flowerSize*.5,flowerSize*.55);temp.rotation.set(0,0,0);temp.updateMatrix();centers.setMatrixAt(i,temp.matrix);
    }
    petals.instanceMatrix.needsUpdate=true;centers.instanceMatrix.needsUpdate=true;forestGroup.add(petals,centers);
    const seatMat='#8a5b39',supportMat='#64452f';
    for(let row=0;row<3;row++){
      const x=L/2+4.6+row*1.05,level=.38+row*.34;
      addBox(forestGroup,supportMat,x,.08+row*.23,0,.78,.28+row*.22,seatLength,{roughness:.9});
      addBox(forestGroup,seatMat,x-.12,level,0,.42,.14,seatLength,{roughness:.8});
    }
    for(const end of [-1,1]){
      addBox(forestGroup,supportMat,L/2+5.6,.82,end*(seatLength/2+.08),2.7,.14,.16);
      for(let row=0;row<3;row++)addBox(forestGroup,supportMat,L/2+4.6+row*1.05,.4+row*.34,end*(seatLength/2-.12),.12,.5,.12);
    }
    const rail=mat('#b58a5d');
    const backRail=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,seatLength),rail);backRail.position.set(L/2+7,1.55,0);forestGroup.add(backRail);
    forestAnimals=[];
    const sphereGeometry=new THREE.SphereGeometry(1,10,8),legGeometry=new THREE.CylinderGeometry(.045,.06,.4,6),earGeometry=new THREE.ConeGeometry(.1,.22,5);
    const addPart=(parent,geometry,color,position,scale)=>{
      const mesh=new THREE.Mesh(geometry,mat(color,.86));mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=false;parent.add(mesh);return mesh;
    };
    for(let dog=0;dog<3;dog++){
      const root=new THREE.Group(),coat=['#c58b52','#51453f','#e8dfcf'][dog],dark=['#493322','#292522','#796e62'][dog],legs=[];
      addPart(root,sphereGeometry,coat,[0,.58,0],[.5,.25,.27]);
      addPart(root,sphereGeometry,coat,[.39,.69,0],[.23,.23,.2]);
      addPart(root,sphereGeometry,dark,[.57,.61,0],[.15,.1,.13]);
      for(const side of [-1,1])addPart(root,earGeometry,dark,[.32,.88,side*.13],[.75,1,.68]);
      const tail=addPart(root,legGeometry,coat,[-.5,.72,0],[.6,1,.6]);tail.rotation.z=-1.0;
      for(const x of [-.29,.29])for(const z of [-.16,.16]){
        const pivot=new THREE.Group();pivot.position.set(x,.39,z);
        const leg=addPart(pivot,legGeometry,dark,[0,-.19,0],[.9,1,.9]);root.add(pivot);legs.push(pivot);
      }
      root.userData.walk={legs,phase:dog*.34,speed:1.1+dog*.12};
      forestGroup.add(root);forestAnimals.push(root);
    }
    if(!animalAnimationTimer)animalAnimationTimer=window.setInterval(()=>{
      if(document.visibilityState==='hidden'||!canvas.isConnected||!canvas.clientWidth||getState().view!=='3d')return;
      const now=performance.now()*.001,current=getState(),unitScale=current.unit==='ft'?.3048:1,fieldLength=(Number(current.length)||40)*unitScale,fieldWidth=(Number(current.width)||24)*unitScale,margin=3.2,hx=fieldLength/2+margin,hz=fieldWidth/2+margin,perimeter=4*(hx+hz);
      for(const animal of forestAnimals){
        const walk=animal.userData.walk;if(!walk)continue;
        const distance=(now*walk.speed+walk.phase*perimeter)%perimeter,segments=[2*hx,2*hz,2*hx,2*hz];let d=distance,segment=0;
        while(segment<3&&d>segments[segment]){d-=segments[segment];segment++}
        const t=d/segments[segment];let x,z,yaw;
        if(segment===0){x=-hx+d;z=-hz;yaw=0}
        else if(segment===1){x=hx;z=-hz+d;yaw=-Math.PI/2}
        else if(segment===2){x=hx-d;z=hz;yaw=Math.PI}
        else{x=-hx;z=hz-d;yaw=Math.PI/2}
        animal.position.set(x,-.4+Math.abs(Math.sin(now*6+walk.phase))*.025,z);animal.rotation.y=yaw;
        walk.legs.forEach((leg,index)=>{leg.rotation.z=Math.sin(now*7+walk.phase+(index%2)*Math.PI)*.32});
      }
      renderer.render(scene,camera);
    },80);
    forestGroup.userData.signature=`${L}|${W}`;
  }
  function buildFloor(s) {
    clearGroup(floorGroup);
    const unitScale = s.unit === 'ft' ? .3048 : 1, L = (Number(s.length) || 40) * unitScale, W = (Number(s.width) || 24) * unitScale;
    addBox(floorGroup, '#544066', 0, -.18, 0, L + 1.1, .36, W + 1.1);
    addBox(floorGroup, '#e9def4', 0, .005, 0, L, .04, W);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, .045, W)), new THREE.LineBasicMaterial({ color: '#806998' }));
    outline.position.y = .04; floorGroup.add(outline);
    if (s.grid) {
      const points = [], step = Math.max(.5, (Number(s.gridSize) || 2) * (s.unit === 'ft' ? .3048 : 1));
      for (let x = -L / 2; x <= L / 2 + .001; x += step) { points.push(new THREE.Vector3(x, .032, -W / 2), new THREE.Vector3(x, .032, W / 2)); }
      for (let z = -W / 2; z <= W / 2 + .001; z += step) { points.push(new THREE.Vector3(-L / 2, .032, z), new THREE.Vector3(L / 2, .032, z)); }
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      floorGroup.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#9e8aae', transparent: true, opacity: .28 })));
      const labelStep=step*Math.max(1,Math.ceil(Math.max(L,W)/16/step));
      for(let x=0;x<=L+.001;x+=labelStep){const label=createLabel(`${x.toFixed(1).replace('.',',')} m`,'#f8f2fc','#514361');label.position.set(-L/2+x,.07,W/2-.15);label.scale.set(.72,.18,1);floorGroup.add(label)}
      for(let z=0;z<=W+.001;z+=labelStep){const label=createLabel(`${z.toFixed(1).replace('.',',')} m`,'#f8f2fc','#514361');label.position.set(-L/2+.2,.07,W/2-z);label.scale.set(.72,.18,1);floorGroup.add(label)}
    }
    floorGroup.userData.signature = `${L}|${W}|${s.grid}|${s.gridSize}|${s.unit}`;
    const radius = Math.hypot(L, W) * 1.4;
    target.set(0, .3, 0); distance = Math.max(25, radius);
    sun.shadow.camera.left = -L; sun.shadow.camera.right = L; sun.shadow.camera.top = W; sun.shadow.camera.bottom = -W; sun.shadow.camera.updateProjectionMatrix();
    camera.far = radius * 5; camera.updateProjectionMatrix();
  }
  function routeVariants(nodes){const groups=[];for(const node of [...nodes].sort((a,b)=>a.n-b.n||(a._visitIndex??0)-(b._visitIndex??0))){const last=groups.at(-1);if(last&&last[0].n===node.n)last.push(node);else groups.push([node])}let variants=[[]];for(const group of groups){const next=[];for(const prefix of variants){for(const node of group){next.push([...prefix,node]);if(next.length>=4)break}if(next.length>=4)break}variants=next}return variants}
  function routeVariantColor(index,base){return index===0?base:['#e56d49','#159e89','#397fd0'][(index-1)%3]}
  function buildRoute(s) {
    clearGroup(routeGroup);
    const courses=(Array.isArray(s.courses)&&s.courses.length?s.courses:[{id:s.activeCourseId||'main',obstacles:s.obstacles,route:s.route,color:s.path,routeBends:s.routeBends,visible:true}]).filter(course=>course.visible!==false);
    for(const course of courses){
      const obstacles=Array.isArray(course.obstacles)?course.obstacles:s.obstacles,byId=new Map(obstacles.map(o=>[o.id,o])),routeState={...s,obstacles,activeCourseId:course.id,route:course.route||[],routeBends:course.routeBends||{},path:course.color||s.path},visits=Array.isArray(routeState.route)?routeState.route.map((visit,index)=>({visit,index,key:typeof visit==='string'?visit:visit?.obstacleId})).filter(item=>byId.has(item.key)):[];
      const baseOrdered=(visits.length?visits.map(({visit,index,key})=>({...byId.get(key),n:Number.isInteger(visit?.n)?visit.n:byId.get(key).n,_reverse:visit?.reverse===true,_visitIndex:index,_visitKey:`${key}@${index}`})):course.automatic===false?[]:[...obstacles].sort((a,b)=>a.n-b.n)).sort((a,b)=>a.n-b.n||(a._visitIndex??0)-(b._visitIndex??0)),variants=routeVariants(baseOrdered);
      for(const [variantIndex,ordered] of variants.entries()){
      const routeColor=routeVariantColor(variantIndex,course.color||s.path||'#f07851');
      const links=ordered.slice(0,-1).map((a,i)=>({ai:i,bi:i+1,a,b:ordered[i+1],prev:ordered[i-1]||a,next:ordered[i+2]||ordered[i+1]}));
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
        const routeKey = `${a._visitKey||a.id}:${b._visitKey||b.id}`;
        const offset = (routeState.routeBends?.[routeKey] ?? routeState.routeBends?.[`${a.id}:${b.id}`] ?? 0) * Math.min(L, W);
        const align = len * .2, ra = (Number(a.rotation) || 0) * Math.PI / 180, rb = (Number(b.rotation) || 0) * Math.PI / 180;
        const startTangent = ta && ta.exit.clone().sub(ta.points.at(-2)).normalize(), endTangent = tb && tb.points[1].clone().sub(tb.entry).normalize();
        const c1 = p0.clone().add(startTangent ? startTangent.multiplyScalar(align) : new THREE.Vector3(p3.x - pp.x, 0, p3.z - pp.z).multiplyScalar(.18).add(new THREE.Vector3(Math.cos(ra) * align, 0, Math.sin(ra) * align))).add(normal.clone().multiplyScalar(offset));
        const c2 = p3.clone().sub(endTangent ? endTangent.multiplyScalar(align) : new THREE.Vector3(pn.x - p0.x, 0, pn.z - p0.z).multiplyScalar(.18).add(new THREE.Vector3(Math.cos(rb) * align, 0, Math.sin(rb) * align))).add(normal.clone().multiplyScalar(offset));
        const curve = new THREE.CubicBezierCurve3(p0, c1, c2, p3);
        if (s.showRoute) {
          const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .035, 6, false), mat(routeColor, .48));
          if(course.id===s.activeCourseId)line.userData.routeKey = routeKey; line.userData.routeNormal = normal; routeGroup.add(line);
          if (tb) {
            const inside = new THREE.CatmullRomCurve3(tb.points);
            const tunnelLine = new THREE.Mesh(new THREE.TubeGeometry(inside, 40, .035, 6, false), mat(routeColor, .48));
            tunnelLine.material.depthTest = false; tunnelLine.renderOrder = 5;
            if(course.id===s.activeCourseId)tunnelLine.userData.routeKey = routeKey; tunnelLine.userData.routeNormal = normal; routeGroup.add(tunnelLine);
          }
        }
        if (s.showDistances) {
          const samples = curve.getPoints(40);
          let meters = 0;
          for (let j = 1; j < samples.length; j++) meters += samples[j].distanceTo(samples[j - 1]);
          const amount = s.unit === 'ft' ? meters / .3048 : meters;
          const measurement = new THREE.BufferGeometry().setFromPoints(samples);
          const measureLine = new THREE.Line(measurement, new THREE.LineDashedMaterial({ color: routeColor, dashSize: .28, gapSize: .18, transparent: true, opacity: .88 }));
          measureLine.computeLineDistances(); routeGroup.add(measureLine);
          const mid = curve.getPoint(.5), label = createLabel(String(amount.toFixed(1)) + ' ' + s.unit, '#fff5c6', '#28433b');
          label.position.set(mid.x, mid.y + .62, mid.z); label.scale.set(1.1, .28, 1); routeGroup.add(label);
        }
      }
      if(s.showRoute&&ordered.length){const unitScale=s.unit==='ft'?.3048:1,L=s.length*unitScale,W=s.width*unitScale;for(let obstacleIndex=0;obstacleIndex<ordered.length;obstacleIndex++){if(obstacleIndex!==0&&ordered[obstacleIndex].type!=='weave')continue;const traversal=obstacleTraversal(routeState,ordered,obstacleIndex,L,W,ordered[obstacleIndex-1],ordered[obstacleIndex+1]),inside=new THREE.CatmullRomCurve3(traversal.points),line=new THREE.Mesh(new THREE.TubeGeometry(inside,Math.max(8,traversal.points.length*2),.035,6,false),mat(routeColor,.48));line.material.depthTest=false;line.renderOrder=5;routeGroup.add(line)}}
      }
    }
    }
  }
  function createLooseNumberMarker(marker, color, courseId, L, W) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d');
    context.beginPath(); context.arc(64, 64, 52, 0, Math.PI * 2); const variant=Number(marker.variant)===2; context.fillStyle = variant?'#fff0e8':'#fffdf4'; context.fill();
    context.lineWidth = 8; context.strokeStyle = variant?'#e56d49':(color || '#8b5cf6'); context.stroke();
    context.fillStyle = variant?'#7b2f1d':'#342145'; context.font = '700 58px system-ui, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(marker.n), 64, 66, 92);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.renderOrder = 4; sprite.position.set((marker.x - .5) * L, .68, (marker.y - .5) * W); sprite.scale.set(.72, .72, 1);
    sprite.userData.looseMarkerId = marker.id; sprite.userData.courseId = courseId; sprite.userData.markerVariant = variant?2:1; markerGroup.add(sprite);
  }
  function update(s) {
    const unitScale = s.unit === 'ft' ? .3048 : 1;
    const signature = `${(Number(s.length) || 40) * unitScale}|${(Number(s.width) || 24) * unitScale}|${s.grid}|${s.gridSize}|${s.unit}`;
    if (floorGroup.userData.signature !== signature) buildFloor(s);
    const L = (Number(s.length) || 40) * unitScale, W = (Number(s.width) || 24) * unitScale;
    if(forestGroup.userData.signature!==`${L}|${W}`)buildForest(s,L,W);
    const visibleCourses=(Array.isArray(s.courses)&&s.courses.length?s.courses:[{id:s.activeCourseId||'main',obstacles:s.obstacles,route:s.route,routeBends:s.routeBends,color:s.path,visible:true}]).filter(course=>course.visible!==false),liveIds=new Set(),obstacleGroups=new Map(obstacleGroup.children.map(child=>[child.userData.obstacleId,child]));
    for (const course of visibleCourses) for (const obstacle of course.obstacles||s.obstacles) {
      const courseState={...s,activeCourseId:course.id,obstacles:course.obstacles||s.obstacles,route:course.route||[],routeBends:course.routeBends||{},path:course.color||s.path};
      liveIds.add(obstacle.id);
      let g = obstacleGroups.get(obstacle.id);
      const geometrySignature = `${obstacle.type}|${obstacle.length || ''}|${obstacle.bend || ''}|${obstacle.height || ''}|${obstacle.poleCount || ''}`;
      if (!g || g.userData.geometrySignature !== geometrySignature) {
        if (g) { obstacleGroup.remove(g); disposeObject(g); }
        g = makeObstacle(obstacle,courseState); obstacleGroup.add(g); obstacleGroups.set(obstacle.id,g);
      } else if (g.userData.badgeSignature !== obstacleBadgeSignature(obstacle,courseState)) {
        g.remove(g.userData.badge); g.userData.badge?.traverse?.(item=>{item.material?.map?.dispose?.();item.material?.dispose?.()});
        g.userData.badge = createObstacleBadge(g, obstacle,courseState); g.userData.badgeSignature = obstacleBadgeSignature(obstacle,courseState);
      }
      if(g.userData.courseId!==course.id){g.userData.courseId=course.id;g.traverse(obj=>{obj.userData.obstacleId=obstacle.id;obj.userData.courseId=course.id})}
      g.userData.badge.visible = !!s.showNumbers;
      g.position.set((obstacle.x - .5) * L, .045, (obstacle.y - .5) * W);
      g.rotation.y = -(Number(obstacle.rotation) || 0) * Math.PI / 180;
    }
    for (const child of [...obstacleGroup.children]) if (!liveIds.has(child.userData.obstacleId)) { obstacleGroup.remove(child); disposeObject(child); }
    const markerSignature=JSON.stringify({L,W,showLooseNumbers:s.showLooseNumbers,showLooseNumbers2:s.showLooseNumbers2,courses:visibleCourses.map(course=>({id:course.id,color:course.color,markers:(course.markers||[]).filter(marker=>Number(marker.variant)===2?s.showLooseNumbers2:s.showLooseNumbers).map(marker=>[marker.id,marker.x,marker.y,marker.n,marker.variant])}))});
    if(markerSignature!==markerBuildSignature){clearGroup(markerGroup);for(const course of visibleCourses)for(const marker of course.markers||[])if(Number(marker.variant)===2?s.showLooseNumbers2:s.showLooseNumbers)createLooseNumberMarker(marker,course.color||s.path,course.id,L,W);markerBuildSignature=markerSignature}
    const routeSignature=JSON.stringify({activeCourseId:s.activeCourseId,unit:s.unit,length:s.length,width:s.width,showRoute:s.showRoute,showDistances:s.showDistances,courses:visibleCourses.map(course=>({id:course.id,color:course.color,automatic:course.automatic,routeBends:course.routeBends||{},route:(course.route||[]).map(visit=>typeof visit==='string'?visit:[visit?.obstacleId,visit?.n,visit?.reverse]),obstacles:(course.obstacles||s.obstacles||[]).map(obstacle=>[obstacle.id,obstacle.type,obstacle.x,obstacle.y,obstacle.n,obstacle.rotation,obstacle.length,obstacle.bend,obstacle.height,obstacle.poleCount])}))});
    if(routeSignature!==routeBuildSignature){buildRoute(s);routeBuildSignature=routeSignature}
    camera.position.set(target.x + Math.sin(azimuth) * Math.cos(elevation) * distance, target.y + Math.sin(elevation) * distance, target.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.lookAt(target);
    const rect = canvas.getBoundingClientRect();
    if(rect.width&&rect.height&&(rect.width!==viewportWidth||rect.height!==viewportHeight)){renderer.setSize(rect.width,rect.height,false);viewportWidth=rect.width;viewportHeight=rect.height;camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix()}
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
    const intersections=caster.intersectObjects([obstacleGroup,markerGroup],true),markerHit=intersections.find(h=>h.object.userData.looseMarkerId);
    const state=getState();
    if(state.tool==='marker'||state.tool==='marker2'){
      const point=new THREE.Vector3();
      if(caster.ray.intersectPlane(ground,point)){
        const unitScale=state.unit==='ft'?.3048:1,variant=state.tool==='marker2'?2:1;
        const x=Math.max(.02,Math.min(.98,point.x/(state.length*unitScale)+.5)),y=Math.max(.03,Math.min(.97,point.z/(state.width*unitScale)+.5));
        onAddMarker?.(x,y,variant);
      }
      e.preventDefault();return;
    }
    if(markerHit){onEditMarker?.(markerHit.object.userData.looseMarkerId,markerHit.object.userData.courseId);e.preventDefault();return}
    const badgeHit=intersections.find(h=>h.object.userData.numberBadge);
    if(badgeHit&&getState().showNumbers){const id=badgeHit.object.userData.obstacleId,courseId=badgeHit.object.userData.courseId,group=obstacleGroup.children.find(item=>item.userData.obstacleId===id),badge=badgeHit.object,badgeWorld=new THREE.Vector3();badge.getWorldPosition(badgeWorld);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-badgeWorld.y);ray(e);const pointerStart=new THREE.Vector3();if(!caster.ray.intersectPlane(plane,pointerStart))return;action={type:'numberBadge',id,courseId,visitIndex:badge.userData.visitIndex??null,badge,group,plane,pointerStart,badgeWorld,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);e.preventDefault();return}
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
      onSelect(id,hit.object.userData.courseId);
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
    } else if (action.type === 'numberBadge') {
      if(!action.moved&&Math.hypot(e.clientX-action.startX,e.clientY-action.startY)<4)return;
      action.moved=true;ray(e);const point=new THREE.Vector3();if(!caster.ray.intersectPlane(action.plane,point))return;
      const world=action.badgeWorld.clone().add(point.sub(action.pointerStart)),local=action.badge.parent.worldToLocal(world);action.badge.position.copy(local);action.badge.parent.updateMatrixWorld(true);
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
  const finish = () => { if(action?.type==='numberBadge'){if(action.moved){const badgeWorld=new THREE.Vector3(),obstacleWorld=new THREE.Vector3(),s=getState(),unitScale=s.unit==='ft'?.3048:1;action.badge.getWorldPosition(badgeWorld);action.group.getWorldPosition(obstacleWorld);onMoveNumber?.(action.id,action.visitIndex,(badgeWorld.x-obstacleWorld.x)/(s.length*unitScale),(badgeWorld.z-obstacleWorld.z)/(s.width*unitScale),action.courseId);onDone()}else{onSelect(action.id,action.courseId);onEditNumber?.(action.id,action.visitIndex)}}if (action?.type === 'move' && action.moved) onDone(); if (action?.type === 'bend'||action?.type==='rotate') onDone(); action = null; last = null; };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { distance = Math.max(10, Math.min(130, distance * (e.deltaY > 0 ? 1.08 : .92))); update(getState()); clearTimeout(wheelTimeout); wheelTimeout = setTimeout(onDone, 400); e.preventDefault(); }, { passive: false });
  const observer = new ResizeObserver(() => update(getState())); observer.observe(canvas.parentElement);
  return { update, renderer, dispose() { observer.disconnect(); clearGroup(obstacleGroup); clearGroup(routeGroup); clearGroup(floorGroup); clearGroup(forestGroup); if(animalAnimationTimer)clearInterval(animalAnimationTimer); forestAnimals=[]; renderer.dispose(); } };
}

