// A rigid icosahedron in an orthographic camera. All page coordinates are logical pixels.
(() => {
  "use strict";

  const radius = 88;
  const floorY = 170;
  const elevation = 1.25;
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

  // Cyclic permutations of (0, 1, phi) with independent signs have a common edge length of two.
  const corners = [];
  for (const sign of [-1, 1]) {
    for (const other of [-1, 1]) {
      corners.push([0, sign, other * goldenRatio], [sign, other * goldenRatio, 0], [other * goldenRatio, 0, sign]);
    }
  }
  const vertices = corners.map(unit);
  const numbers = [20, 2, 8, 16, 6, 14, 11, 4, 18, 9, 3, 5, 13, 10, 15, 19, 17, 12, 7, 1];
  const faces = [];
  // Project the slab along a vertex axis. Every face cuts this plane obliquely.
  const slabNormal = unit([0, 1, goldenRatio]);
  const slabU = unit(cross(slabNormal, [1, 0, 0]));
  const slabV = cross(slabNormal, slabU);
  const slabScale = 0.48;

  function marbleTransform(normal, right, up, height) {
    // UV = centerUV + J * [localRight, localDown]. Canvas needs its inverse.
    const duDx = dot(slabU, right) * slabScale / radius;
    const duDy = -dot(slabU, up) * slabScale / radius;
    const dvDx = dot(slabV, right) * slabScale / radius;
    const dvDy = -dot(slabV, up) * slabScale / radius;
    const determinant = duDx * dvDy - duDy * dvDx;
    const xFromU = dvDy / determinant, xFromV = -duDy / determinant;
    const yFromU = -dvDx / determinant, yFromV = duDx / determinant;
    const centerU = 0.5 + slabScale * height * dot(slabU, normal);
    const centerV = 0.5 + slabScale * height * dot(slabV, normal);
    return [xFromU, yFromU, xFromV, yFromV,
      -xFromU * centerU - xFromV * centerV, -yFromU * centerU - yFromV * centerV];
  }

  function shareEdge(first, second) {
    return Math.abs(Math.hypot(...subtract(corners[first], corners[second])) - 2) < 0.001;
  }

  function makeFace(indices) {
    const normal = unit([0, 1, 2].map(axis => indices.reduce((sum, index) => sum + vertices[index][axis], 0)));
    const [a, b, c] = indices.map(index => vertices[index]);
    if (dot(cross(subtract(b, a), subtract(c, a)), normal) < 0) indices.reverse();
    const apex = vertices[indices[0]];
    const height = dot(apex, normal);
    const up = unit(subtract(apex, normal.map(component => component * height)));
    const right = cross(up, normal);
    const marble = marbleTransform(normal, right, up, height);
    return { indices, normal, up, right, marble, number: numbers[faces.length] };
  }

  for (let first = 0; first < corners.length; first++) {
    for (let second = first + 1; second < corners.length; second++) {
      if (!shareEdge(first, second)) continue;
      for (let third = second + 1; third < corners.length; third++) {
        if (shareEdge(first, third) && shareEdge(second, third)) {
          faces.push(makeFace([first, second, third]));
        }
      }
    }
  }

  function pose(top, progress) {
    const remaining = (1 - progress) ** 2;
    const settle = Math.max(0, (progress - 0.67) / 0.33);
    const tip = progress < 0.67 ? 0 : 0.24 * Math.sin(settle * Math.PI * 3) * (1 - settle) ** 2;
    const pitch = 6.1 * remaining + tip;
    const yaw = 8.0 * remaining + 0.07;
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

  function engraving(ctx, face, art, brightness) {
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
    ctx.fillText(String(face.number), 0, 1);
    if (face.number === 6 || face.number === 9) ctx.fillRect(-5, 15, 10, 1.3);
  }

  function drawFace(ctx, face, orient, screen, art) {
    const normal = orient(face.normal);
    const facing = normal[2] * cameraSin - normal[1] * cameraCos;
    if (facing < 0.0001) return;
    const brightness = Math.max(0, dot(normal, [-0.38, 0.10, 0.92]));
    const tone = Math.round(175 + 74 * brightness);
    const points = face.indices.map(index => screen[index]);
    const center = [0, 1].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / 3);
    polygon(ctx, points);
    ctx.fillStyle = 'rgb(' + tone + ',' + (tone + 2) + ',' + (tone + 5) + ')';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const right = project(orient(face.right));
    const up = project(orient(face.up));
    ctx.transform(right[0], right[1], -up[0], -up[1], ...center);
    engraving(ctx, face, art, brightness);
    ctx.restore();

    polygon(ctx, points);
    ctx.strokeStyle = '#505156';
    ctx.lineWidth = 1.65;
    ctx.stroke();
    // Broken bevel highlights and charcoal cuts follow the same material edges as the ink.
    for (let side = 0; side < 3; side++) {
      const start = points[side], end = points[(side + 1) % 3];
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

  function draw(ctx, t, target, art) {
    const progress = Math.max(0, Math.min(1, t));
    const top = faces.find(face => face.number === target) || faces[0];
    const orient = pose(top, progress);
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
    for (const face of faces) drawFace(ctx, face, orient, screen, art);
    ctx.restore();
  }

  window.RandomD20 = { draw };
})();


