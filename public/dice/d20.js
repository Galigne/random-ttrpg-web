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

  function engraving(ctx, face, art, brightness, marked) {
    window.RandomDiceMaterials.paintTexture(ctx, face, art, radius, brightness);
    ctx.fillStyle = art?.ink || '#292b2e';
    ctx.font = '600 34px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,253,' + (0.4 + brightness * 0.35) + ')';
    ctx.shadowOffsetY = 0.9;
    const veiled = !marked && (face.number === 1 || face.number === 20);
    ctx.fillText(veiled ? "✧" : String(face.number), 0, 1);
    if (face.number === 6 || face.number === 9) ctx.fillRect(-5, 15, 10, 1.3);
  }

  function drawFace(ctx, face, orient, screen, art, effect) {
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
    engraving(ctx, face, art, brightness, !effect || effect.marked);
    ctx.restore();
    if (art?.finish === "silver-rim") return;

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

  const centerOf = points => [0, 1, 2].map(i =>
    points.reduce((sum, p) => sum + p[i], 0) / points.length);
  const rest = pose(faces.find(face => face.number === 1), 1);
  const cameraDepth = ([, away, height]) => height * cameraSin - away * cameraCos;

  // Slice the solid through its interior. Both halves keep their original face coordinates
  // and share a closed cut surface, including where a later cut crosses an earlier one.
  function splitSolid(solid, direction, offset) {
    const normal = unit([[1,0,0], [0,1,0], [0,0,1]].map(axis => dot(rest(axis), direction)));
    const halves = [[], []], rim = [];
    for (const surface of solid) {
      const paths = [[], []];
      surface.points.forEach((a, index, points) => {
        const b = points[(index + 1) % points.length];
        const da = dot(a, normal) - offset, db = dot(b, normal) - offset;
        paths[da > 0 ? 1 : 0].push(a);
        if (da * db >= 0) return;
        const point = a.map((v, i) => v + (b[i] - v) * da / (da - db));
        for (const path of paths) path.push(point);
        if (!rim.some(p => Math.hypot(...subtract(p, point)) < .00001)) rim.push(point);
      });
      paths.forEach((points, i) => {
        if (points.length >= 3) halves[i].push({ ...surface, points });
      });
    }
    const center = centerOf(rim);
    const right = unit(subtract(rim[0], center)), up = cross(normal, right);
    const angle = p => Math.atan2(dot(subtract(p, center), up), dot(subtract(p, center), right));
    rim.sort((a, b) => angle(a) - angle(b));
    // A raised, off-centre ridge gives the mating surfaces a rough fracture profile.
    const ridge = center.map((v, i) => v + .13 * normal[i] + .08 * right[i]);
    rim.forEach((point, j) => {
      const next = rim[(j + 1) % rim.length];
      const facet = unit(cross(subtract(point, ridge), subtract(next, ridge)));
      halves.forEach((half, i) => half.push({
        points: [point, next, ridge], normal: facet.map(n => i ? -n : n), right, up, center,
      }));
    });
    return halves;
  }

  const shell = faces.map(face => ({
    face, normal: face.normal, points: face.indices.map(i => vertices[i]),
  }));
  const [left, right] = splitSolid(shell, [1, .28, .32], .08);
  const pieces = [...splitSolid(left, [-.23, .87, .55], .08),
    ...splitSolid(right, [.32, -.71, .66], -.14)].map((surfaces, index) => {
    const points = surfaces.flatMap(s => s.points);
    const center = centerOf(surfaces.filter(s => s.face).flatMap(s => s.points));
    for (const s of surfaces.filter(s => s.face)) {
      const edges = s.face.indices.map(i => vertices[i]);
      s.breaks = s.points.map((a, i) => [a, s.points[(i + 1) % s.points.length]])
        .filter(segment => !edges.some((a, i) => {
          const edge = subtract(edges[(i + 1) % 3], a);
          return segment.every(p => Math.hypot(...cross(subtract(p, a), edge)) < .00001);
        }));
    }
    const pivot = rest(center);
    return { surfaces, points, center, pivot, spin: [1.25, -1.62, -.98, 1.43][index],
      velocityX: [-18, -117, 151, 36][index], landingDepth: [-18, 8, 12, -9][index],
      axis: unit([.58 + pivot[1], .74 - pivot[0], .21 + pivot[2]]),
      bottom: Math.min(...points.map(p => rest(p)[2])) };
  });

  function drawCut(ctx, surface, orient, positions, pointAt, art) {
    polygon(ctx, positions);
    const light = Math.max(0, dot(orient(surface.normal), [-.43, .15, .89]));
    const tone = Math.round(66 + 119 * light);
    ctx.fillStyle = `rgb(${tone + 12},${tone + 4},${tone})`;
    ctx.fill();
    ctx.clip();
    const [rx, ry] = project(orient(surface.right)), [ux, uy] = project(orient(surface.up));
    ctx.transform(rx, ry, -ux, -uy, ...pointAt(surface.center));
    if (art.texture) {
      ctx.globalAlpha = .54;
      if (art.finish === "silver-rim") {
        ctx.fillStyle = ctx.createPattern(window.RandomDiceMaterials.castGrain(art.texture), "repeat");
        ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
      } else ctx.drawImage(art.texture, -radius, -radius, 2 * radius, 2 * radius);
      ctx.globalAlpha = 1;
    }
    const shade = ctx.createLinearGradient(-68, -75, 36, 80);
    shade.addColorStop(0, "rgba(240,222,197,.35)");
    shade.addColorStop(.55, "rgba(40,30,32,.36)");
    shade.addColorStop(1, "rgba(20,18,22,.7)");
    ctx.fillStyle = shade;
    ctx.fillRect(-180, -180, 360, 360);
    // Fixed striations on the raw break rotate with the stone.
    ctx.strokeStyle = "rgba(240,225,200,.31)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 57; i++) {
      const x = (i * 83 % 157) - 80, y = (i * 39 % 149) - 75;
      ctx.moveTo(x, y); ctx.lineTo(x + 3 + i % 12, y - 2 - i % 6);
    }
    ctx.stroke();
  }

  function rotation(axis, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return p => {
      const tangent = cross(axis, p), parallel = dot(axis, p);
      return p.map((n, i) => n * cos + tangent[i] * sin + axis[i] * parallel * (1 - cos));
    };
  }

  function drawFracture(ctx, effect, art, centerX, centerHeight) {
    const seconds = effect.fall * 1.38;
    const surfaces = [];
    for (const piece of pieces) {
      const gap = centerHeight + effect.lift / cameraCos + radius * piece.bottom;
      const gravity = 620, impact = Math.sqrt(2 * gap / gravity);
      const after = Math.max(0, seconds - impact);
      const rebound = .24 * gravity * impact;
      const air = seconds < impact ? gap - gravity * seconds ** 2 / 2
        : Math.max(0, rebound * after - gravity * after ** 2 / 2);
      const glide = Math.min(seconds, impact) + (1 - Math.exp(-7 * after)) / 7;
      const spin = piece.spin * (effect.quiet ? .52 : 1);
      const tumble = rotation(piece.axis, spin * glide);
      let orient = v => tumble(rest(v));
      if (after > 0) {
        // Rock onto a supporting facet as friction arrests the tumble.
        const finalTurn = rotation(piece.axis, spin * (impact + 1 / 7));
        const down = piece.surfaces.map(s => finalTurn(rest(s.normal))).reduce((a, b) => a[2] < b[2] ? a : b);
        const axis = cross(down, [0, 0, -1]);
        if (Math.hypot(...axis) > .00001) {
          const settle = 1 - Math.exp(-8 * after) * Math.cos(10 * after);
          const rock = rotation(unit(axis), settle * Math.acos(Math.min(1, -down[2])));
          orient = v => rock(tumble(rest(v)));
        }
      }
      const pivot = orient(piece.center);
      const rotated = piece.points.map(orient);
      const bottom = Math.min(...rotated.map(p => p[2]));
      const ground = radius * (pivot[2] - bottom);
      const travel = glide / (impact + 1 / 7);
      const x = centerX + piece.pivot[0] * radius + piece.velocityX * glide * (effect.quiet ? .65 : 1);
      const away = piece.pivot[1] * radius * (1 - .8 * travel) + piece.landingDepth * travel;
      const y = floorY - away * cameraSin - (ground + air) * cameraCos;
      const pointAt = p => {
        const [dx, dy] = project(subtract(orient(p), pivot));
        return [x + radius * dx, y + radius * dy];
      };
      const floor = floorY - away * cameraSin;
      if (effect.fall) {
        const contact = centerOf(rotated.filter(p => p[2] < bottom + .06));
        shadow(ctx, x + radius * (contact[0] - pivot[0]), floor - radius * (contact[1] - pivot[1]) * cameraSin,
          38, 14, .47 / (1 + air / 60));
      }
      if (after > 0 && after < .36 && !effect.quiet) {
        const dust = after / .36;
        ctx.fillStyle = `rgba(123,100,75,${.34 * (1 - dust) ** 2})`;
        for (let i = 0; i < 14; i++) {
          const angle = i * 2.4 + piece.spin;
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * (10 + dust * 49), floor + Math.sin(angle) * dust * 18 - 8 * dust,
            (1.4 + i % 3) * (1 - dust / 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const screen = vertices.map(pointAt);
      for (const surface of piece.surfaces) {
        if (cameraDepth(orient(surface.normal)) <= .0001) continue;
        const center = centerOf(surface.points);
        surfaces.push({ surface, orient, pointAt, screen, positions: surface.points.map(pointAt),
          depth: cameraDepth([x, away, ground + air]) + radius * cameraDepth(subtract(orient(center), pivot)) });
      }
    }
    surfaces.sort((a, b) => a.depth - b.depth);
    for (const { surface, positions, orient, pointAt, screen } of surfaces) {
      ctx.save();
      if (surface.face) {
        polygon(ctx, positions);
        ctx.clip();
        drawFace(ctx, surface.face, orient, screen, art, effect);
        // The thin dark lip exposes the actual break across the printed numbers and texture.
        ctx.beginPath();
        for (const [a, b] of surface.breaks) {
          ctx.moveTo(...pointAt(a));
          ctx.lineTo(...pointAt(b));
        }
        ctx.strokeStyle = "#f3d4a0";
        ctx.lineWidth = effect.cracks * 5;
        ctx.stroke();
        ctx.strokeStyle = "#322b30";
        ctx.lineWidth = effect.cracks * 3;
        ctx.stroke();
      } else drawCut(ctx, surface, orient, positions, pointAt, art);
      ctx.restore();
    }
  }

  function draw(ctx, t, target, art, effect) {
    const progress = Math.max(0, Math.min(1, t));
    const top = faces.find(face => face.number === target) || faces[0];
    const orient = pose(top, progress);
    const world = vertices.map(orient);
    const hop = progress < 0.67 ? 49 * Math.sin(Math.PI * progress / 0.67) : 0;
    // Raising the lowest corner to floor height makes each final edge roll into a flat tripod.
    const centerHeight = -Math.min(...world.map(vertex => vertex[2])) * radius + hop;
    const centerX = 220 - 58 * (1 - progress) ** 2 + (effect?.shakeX || 0);
    const centerY = floorY - centerHeight * cameraCos - (effect?.lift || 0) + (effect?.shakeY || 0);
    const screen = world.map(vertex => {
      const [right, down] = project(vertex);
      return [centerX + radius * right, centerY + radius * down];
    });
    ctx.save();
    const fall = effect?.fall || 0;
    shadow(ctx, centerX + 13, floorY + 1, 82 + hop / 5, 45, (0.23 - hop / 400) * (1 - fall));
    shadow(ctx, centerX + 4, floorY + 3, 56, 32,
      0.40 * (1 - hop / 55) * (1 - (effect?.lift || 0) / 48) * (1 - fall));
    if (art?.glow) window.RandomDiceMaterials.halo(ctx, centerX, centerY, art.glow, effect?.light ?? .32);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (effect?.cracks) drawFracture(ctx, effect, art, centerX, centerHeight);
    else for (const face of faces) drawFace(ctx, face, orient, screen, art, effect);
    if (effect?.burst) sparkles(ctx, centerX, centerY, effect.burst, art.glow, effect.quiet);
    ctx.restore();
  }

  // Bake the colored bloom and hot core once per glow, then stamp them in three waves.
  const glints = new Map();
  function starSprite(color) {
    if (glints.has(color)) return glints.get(color);
    const tile = document.createElement("canvas");
    tile.width = tile.height = 64;
    const pen = tile.getContext("2d");
    pen.translate(32, 32);
    const bloom = pen.createRadialGradient(0, 0, 0, 0, 0, 32);
    bloom.addColorStop(0, "#fffae8");
    bloom.addColorStop(.13, color);
    bloom.addColorStop(.37, color + "a6");
    bloom.addColorStop(1, color + "00");
    pen.fillStyle = bloom;
    pen.fillRect(-32, -32, 64, 64);
    const points = [];
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const length = i % 2 ? 3.3 : i % 4 ? 12 : 29;
      points.push([Math.cos(angle) * length, Math.sin(angle) * length]);
    }
    polygon(pen, points);
    pen.strokeStyle = "rgba(68,48,43,.55)";
    pen.lineWidth = 1.8;
    pen.stroke();
    pen.fillStyle = color;
    pen.fill();
    pen.scale(.48, .48);
    polygon(pen, points);
    pen.fillStyle = "#fffbed";
    pen.fill();
    if (glints.size >= 12) glints.delete(glints.keys().next().value);
    glints.set(color, tile);
    return tile;
  }

  const sparks = Array.from({ length: 190 }, (_, i) => {
    const turn = i * 2.399963, seed = (i * 67 % 101) / 101;
    return {
      dx: Math.cos(turn), dy: Math.sin(turn),
      birth: (i % 3) * .18 + .12 * seed,
      life: .36 + .15 * ((i * 41 % 79) / 79),
      origin: 19 + (i * 37 % 55), reach: 58 + (i * 43 % 87),
      curl: 14 * Math.sin(i * 13), size: i % 8 === 0 ? 26 + 17 * seed : 5 + 12 * seed,
      trail: i % 7 === 0, turn,
    };
  });

  function starTrails(ctx, x, y, phase, color, sprite, quiet) {
    for (let i = 0; i < 12; i++) {
      const age = (phase - .17 * (i % 3)) / .65;
      if (age <= 0 || age >= 1) continue;
      const angle = i * 2.4 + .31, dx = Math.cos(angle), dy = Math.sin(angle);
      function position(t) {
        const travel = (1 - (1 - t) ** 2) * (quiet ? .57 : 1);
        const curl = Math.sin(t * 2.4 + i) * travel * 23;
        return [x + dx * (49 + travel * (103 + i % 4 * 11)) - dy * curl,
          y + dy * (35 + travel * 56) - Math.sin(t * Math.PI) * 24 + dx * curl + 23 * t * t];
      }
      const strength = Math.min(1, age * 9) * (1 - age ** 2);
      ctx.globalAlpha = strength;
      ctx.beginPath();
      const tail = quiet ? .13 : .33;
      for (let j = 0; j <= 12; j++) {
        const point = position(Math.max(0, age - tail * (1 - j / 12)));
        if (!j) ctx.moveTo(...point);
        else ctx.lineTo(...point);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.6 * strength;
      ctx.stroke();
      ctx.strokeStyle = "#fff6de";
      ctx.lineWidth = 1.25 * strength;
      ctx.stroke();
      const [sx, sy] = position(age);
      const size = (33 + 4 * (i % 4)) * (.58 + .42 * strength);
      ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
    }
  }

  function sparkles(ctx, x, y, phase, color, quiet) {
    const sprite = starSprite(color);
    starTrails(ctx, x, y, phase, color, sprite, quiet);
    for (const s of sparks) {
      const age = (phase - s.birth) / s.life;
      if (age <= 0 || age >= 1) continue;
      const travel = 1 - (1 - age) ** 2;
      const distance = s.origin + s.reach * travel * (quiet ? .5 : 1);
      const curl = s.curl * Math.sin(Math.PI * age);
      const sx = x + s.dx * distance - s.dy * curl;
      const sy = y + s.dy * distance * .64 + s.dx * curl - 14 * travel + 26 * age ** 2;
      const envelope = Math.min(1, age * 9) * (1 - age ** 2);
      const twinkle = quiet ? 1 : .81 + .19 * Math.cos(s.turn + age * 11);
      const size = s.size * twinkle * (.6 + .4 * envelope);
      ctx.globalAlpha = envelope;
      if (s.trail && !quiet) {
        const tail = (1 - age) * 23;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.7 * envelope;
        ctx.beginPath();
        ctx.moveTo(sx - tail * s.dx, sy - tail * s.dy * .64);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
    }
  }

  function drawCritical(ctx, t, target, art, quiet) {
    const phase = (start, end) => Math.max(0, Math.min(1, (t - start) / (end - start)));
    const rise = phase(.21, .61);
    const resolve = phase(.62, 1);
    const failure = target === 20 && resolve > 0;
    const fall = failure ? phase(.73, .99) : 0;
    const tension = quiet ? 0 : rise * (1 - phase(.62, .73));
    const roll = quiet ? .96 + .04 * phase(0, .62) : .78 * phase(0, .34) + .22 * phase(.34, .62);
    // Use one landing pose and veil both critical numerals throughout suspense.
    draw(ctx, roll, 1, art, {
      marked: !failure && resolve > 0,
      lift: rise * (quiet ? 12 : 31),
      shakeX: tension * Math.sin(t * 306) * 3.6,
      shakeY: tension * Math.sin(t * 243) * 2,
      light: (.10 + .57 * phase(0, .62) + .33 * phase(.62, .72)) *
        (1 - (failure ? phase(.72, .84) : phase(.8, 1))),
      cracks: failure ? phase(.62, .72) : 0,
      fall, burst: failure ? 0 : resolve, quiet,
    });
  }

  window.RandomD20 = { draw, drawCritical };
})();


