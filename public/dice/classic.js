// Marble polyhedra use the same camera model and material as RANDOM's D20.
(() => {
  "use strict";

  const radius = 88;
  const floorY = 170;
  const elevation = 1.04;
  const cameraSin = Math.sin(elevation);
  const cameraCos = Math.cos(elevation);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  function dot(first, second) {
    return first.reduce((sum, value, index) => sum + value * second[index], 0);
  }

  function cross([ax, ay, az], [bx, by, bz]) {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  }

  function subtract(first, second) {
    return first.map((value, index) => value - second[index]);
  }

  function unit(vector) {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  }

  const slabNormal = unit([0.31, 0.53, 0.79]);
  const slabU = unit(cross(slabNormal, [1, 0, 0]));
  const slabV = cross(slabNormal, slabU);
  const slabScale = 0.48;

  function marbleTransform(center, right, up) {
    // UV = centerUV + J * [localRight, localDown]. Canvas needs its inverse.
    const duDx = dot(slabU, right) * slabScale / radius;
    const duDy = -dot(slabU, up) * slabScale / radius;
    const dvDx = dot(slabV, right) * slabScale / radius;
    const dvDy = -dot(slabV, up) * slabScale / radius;
    const determinant = duDx * dvDy - duDy * dvDx;
    const xFromU = dvDy / determinant, xFromV = -duDy / determinant;
    const yFromU = -dvDx / determinant, yFromV = duDx / determinant;
    const centerU = 0.5 + slabScale * dot(slabU, center);
    const centerV = 0.5 + slabScale * dot(slabV, center);
    return [xFromU, yFromU, xFromV, yFromV,
      -xFromU * centerU - xFromV * centerV, -yFromU * centerU - yFromV * centerV];
  }

  function corners(sides) {
    const signs = [-1, 1];
    const points = [];
    if (sides === 8) {
      for (const s of signs) points.push([s, 0, 0], [0, s, 0], [0, 0, s]);
    } else if (sides === 10) {
      // Interleave two pentagons. This offset makes each pole and its three
      // adjoining ring vertices coplanar, forming a kite instead of triangles.
      const pole = 1.12;
      const c = Math.cos(Math.PI / 5);
      const rise = pole * (1 - c) / (1 + c);
      points.push([0, 0, pole], [0, 0, -pole]);
      for (let i = 0; i < 10; i++)
        points.push([Math.cos(i * Math.PI / 5), Math.sin(i * Math.PI / 5), i % 2 ? -rise : rise]);
    } else {
      for (const x of signs) for (const y of signs) for (const z of signs)
        if (sides !== 4 || x*y*z === 1) points.push([x, y, z]);
      if (sides === 12) for (const a of signs) for (const b of signs) {
        const u = a / goldenRatio, v = b * goldenRatio;
        points.push([0, u, v], [u, v, 0], [v, 0, u]);
      }
    }
    const scale = Math.max(...points.map(point => Math.hypot(...point)));
    return points.map(point => point.map(value => value / scale));
  }

  function makeMesh(sides) {
    const vertices = corners(sides);
    const faces = [];
    const seen = new Set();
    // Discover supporting planes once; include every coplanar corner in a single facet.
    for (let a = 0; a < vertices.length; a++) for (let b = a+1; b < vertices.length; b++)
      for (let c = b+1; c < vertices.length; c++) {
        let normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]));
        if (Math.hypot(...normal) < 1e-8) continue;
        normal = unit(normal);
        if (dot(normal, vertices[a]) < 0) normal = normal.map(x => -x);
        const height = dot(normal, vertices[a]);
        const gaps = vertices.map(v => dot(v,normal) - height);
        if (gaps.some(g => g > 1e-7)) continue;
        const indices = vertices.map((_,i) => i).filter(i => Math.abs(gaps[i]) < 1e-7);
        const key = indices.join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        const center = [0,1,2].map(axis => indices.reduce((sum,i) => sum + vertices[i][axis],0)/indices.length);
        let up = unit(subtract(vertices[indices[0]], center));
        let right = cross(up, normal);
        const angle = i => Math.atan2(dot(subtract(vertices[i],center),up), dot(subtract(vertices[i],center),right));
        indices.sort((i,j) => angle(i)-angle(j));
        if (sides === 6) {
          right = unit(subtract(vertices[indices[1]], vertices[indices[0]]));
          up = cross(normal,right);
        }
        const marks = sides === 4 ? indices.map(i => {
          const delta = subtract(vertices[i],center);
          const x = dot(delta,right), y = -dot(delta,up);
          return { value:i+1, x:x*radius*.58, y:y*radius*.58, angle:Math.atan2(x,-y) };
        }) : [];
        faces.push({indices,normal,up,right,marks,marble:marbleTransform(center,right,up)});
      }
    let low = 1;
    for (const face of faces) {
      if (face.number) continue;
      face.number = low;
      const opposite = faces.find(other => dot(other.normal,face.normal) < -.999999);
      if (opposite) opposite.number = sides+1-low;
      low++;
    }
    const landings = sides === 4 ? vertices.map((normal,i) => {
      const front = faces.find(face => face.indices.includes(i)).normal;
      const up = unit(normal.map((v,axis) => v*dot(front,normal)-front[axis]));
      return {normal,up,right:cross(up,normal)};
    }) : Array.from({length:sides}, (_,i) => faces.find(face => face.number === i+1));
    return {vertices,faces,landings};
  }
  const meshes = new Map([4,6,8,10,12].map(sides => [sides, makeMesh(sides)]));

  function pose(top, progress, sides, place) {
    const remaining = (1 - progress) ** 2;
    const settle = Math.max(0, (progress - 0.67) / 0.33);
    const tip = progress < 0.67 ? 0 : 0.24 * Math.sin(settle * Math.PI * 3) * (1 - settle) ** 2;
    const pitch = (place === 'units' ? -5.4 : 6.1) * remaining + tip;
    const restYaw = sides === 4 ? 0.94 : sides === 6 ? 0.46 : 0.28;
    const yaw = 8.0 * remaining + (place === 'units' ? -restYaw : restYaw);
    const bank = 3.1 * remaining;
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
    const cosBank = Math.cos(bank), sinBank = Math.sin(bank);

    return vector => {
      const right = dot(vector, top.right);
      const away = dot(vector, top.up);
      const height = dot(vector, top.normal);
      const spunRight = right * cosYaw - away * sinYaw;
      const spunAway = right * sinYaw + away * cosYaw;
      const tiltedAway = spunAway * cosPitch - height * sinPitch;
      const tiltedHeight = spunAway * sinPitch + height * cosPitch;
      return [spunRight * cosBank + tiltedHeight * sinBank, tiltedAway, tiltedHeight * cosBank - spunRight * sinBank];
    };
  }

  function project([right, away, height]) {
    return [right, -away * cameraSin - height * cameraCos];
  }

  function polygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
  }

  function shadow(ctx, x, y, width, height, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(width, height);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(42, 35, 26, ' + opacity + ')');
    gradient.addColorStop(0.63, 'rgba(42, 35, 26, ' + opacity * 0.54 + ')');
    gradient.addColorStop(1, 'rgba(42, 35, 26, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function engraving(ctx, face, art, brightness, label) {
    if (art && art.naturalWidth) {
      ctx.save();
      ctx.transform(...face.marble);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.92;
      ctx.drawImage(art, 0, 0, 1, 1);
      ctx.restore();
    }
    ctx.fillStyle = '#292b2e';
    ctx.font = '600 34px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,253,' + (0.4 + brightness * 0.35) + ')';
    ctx.shadowOffsetY = 0.9;
    if (face.marks.length) {
      ctx.font = '600 30px Cinzel, Georgia, serif';
      for (const mark of face.marks) {
        ctx.save();
        ctx.translate(mark.x, mark.y);
        ctx.rotate(mark.angle);
        ctx.fillText(String(mark.value), 0, 0);
        ctx.restore();
      }
      return;
    }
    ctx.fillText(label, 0, 1);
    if (label === '6' || label === '9') ctx.fillRect(-5, 15, 10, 1.3);
  }

  function drawFace(ctx, face, orient, screen, art, label) {
    const normal = orient(face.normal);
    const facing = normal[2] * cameraSin - normal[1] * cameraCos;
    if (facing < 0.0001) return;
    const brightness = Math.max(0, dot(normal, [-0.38, 0.10, 0.92]));
    const tone = Math.round(175 + 74 * brightness);
    const points = face.indices.map(index => screen[index]);
    const center = [0, 1].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
    polygon(ctx, points);
    ctx.fillStyle = 'rgb(' + tone + ',' + (tone + 2) + ',' + (tone + 5) + ')';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const right = project(orient(face.right));
    const up = project(orient(face.up));
    ctx.transform(right[0], right[1], -up[0], -up[1], ...center);
    engraving(ctx, face, art, brightness, label);
    ctx.restore();

    polygon(ctx, points);
    ctx.strokeStyle = '#505156';
    ctx.lineWidth = 1.65;
    ctx.stroke();
    // Broken bevel highlights and charcoal cuts follow the same material edges as the ink.
    for (let side = 0; side < points.length; side++) {
      const start = points[side], end = points[(side + 1) % points.length];
      const inset = 0.035 + 0.008 * ((face.number + side) % 3);
      const pointAt = fraction => start.map((value, axis) =>
        (value + (end[axis] - value) * fraction) * (1 - inset) + center[axis] * inset);
      ctx.beginPath();
      ctx.moveTo(...pointAt(0.03));
      ctx.lineTo(...pointAt(0.75 + (face.number % 4) * 0.05));
      ctx.strokeStyle = side === 1 ? 'rgba(52,54,60,.51)' : 'rgba(255,255,252,.85)';
      ctx.lineWidth = side === 1 ? 0.7 : 1.05;
      ctx.stroke();
    }
  }

  function drawSolid(ctx, t, sides, target, art, place) {
    const progress = Math.max(0, Math.min(1, t));
    const {vertices, faces, landings} = meshes.get(sides);
    const top = landings[target - 1];
    const orient = pose(top, progress, sides, place);
    const world = vertices.map(orient);
    const hop = progress < 0.67 ? 49 * Math.sin(Math.PI * progress / 0.67) : 0;
    // Raising the lowest corner to floor height makes each final edge roll into a flat tripod.
    const centerHeight = -Math.min(...world.map(vertex => vertex[2])) * radius + hop;
    const centerX = 220 - 58 * (1 - progress) ** 2;
    const centerY = floorY - centerHeight * cameraCos;
    const screen = world.map(vertex => {
      const [right, down] = project(vertex);
      return [centerX + radius * right, centerY + radius * down];
    });
    ctx.save();
    shadow(ctx, centerX + 13, floorY + 1, 82 + hop / 5, 45, 0.23 - hop / 400);
    shadow(ctx, centerX + 4, floorY + 3, 56, 32, 0.40 * (1 - hop / 55));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const face of faces) {
      const digit = String(face.number % 10);
      const label = place === 'tens' ? digit + '0' : place === 'units' ? digit : String(face.number);
      drawFace(ctx, face, orient, screen, art, label);
    }
    ctx.restore();
  }

  function draw(ctx, t, sides, target, art) {
    if (sides !== 100) return drawSolid(ctx, t, sides, target, art);
    const tens = Math.floor((target % 100) / 10), units = target % 10;
    for (const [x, digit, place] of [[112, tens, 'tens'], [328, units, 'units']]) {
      ctx.save();
      ctx.translate(x, 18);
      ctx.scale(.89,.89);
      ctx.translate(-220,0);
      drawSolid(ctx, t, 10, digit || 10, art, place);
      ctx.restore();
    }
  }
  window.RandomClassicDice = { draw, supports: sides => sides === 100 || meshes.has(sides) };
})();
