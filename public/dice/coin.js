(() => {
  "use strict";

  const turn = 2 * Math.PI;
  const radius = 77;
  const thickness = 7;
  const restAngle = 0.57;

  function shadow(ctx, x, y, rx, ry, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const ink = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    ink.addColorStop(0, `rgba(55,47,38,${opacity})`);
    ink.addColorStop(0.64, `rgba(55,47,38,${opacity * 0.48})`);
    ink.addColorStop(1, "rgba(55,47,38,0)");
    ctx.fillStyle = ink;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function ellipse(ctx, h, offset) {
    ctx.beginPath();
    ctx.ellipse(0, offset, radius, h, 0, 0, turn);
  }

  function silverReflection(ctx, angle) {
    ctx.save();
    ctx.rotate(-0.46);
    // One broad, broken-edged reflection follows the tilt of the hammered field.
    // Soft light lifts the graphite midtones and preserves ink in the recesses.
    ctx.translate(radius * Math.sin(2 * angle), 0);
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(250, 252, 253, 0.56)";
    ctx.beginPath();
    ctx.moveTo(-22, -radius);
    ctx.lineTo(9, -radius);
    ctx.lineTo(12, -18);
    ctx.lineTo(8, 6);
    ctx.lineTo(15, radius);
    ctx.lineTo(-6, radius);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(ctx, t, target, art) {
    const frame = Math.min(1, Math.max(0, t));
    const flight = Math.min(1, frame / 0.54);
    const rebound = Math.min(1, Math.max(0, (frame - 0.54) / 0.23));
    const settling = Math.min(1, Math.max(0, (frame - 0.77) / 0.19));
    const altitude = 4 * flight * (1 - flight) * 71
      + 4 * rebound * (1 - rebound) * 20
      + 4 * settling * (1 - settling) * 3;
    const stopAngle = restAngle + turn * 2 + (target === 2 ? Math.PI : 0);
    const startAngle = 1.42;
    const angle = startAngle + (stopAngle - 0.72 - startAngle) * flight
      + 0.72 * rebound + Math.sin(Math.PI * rebound) * 1.04
      + Math.sin(settling * turn) * (1 - settling) * 0.42;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = 185 + flight * 29 + rebound * 5 + settling;
    const y = 155 - altitude - (1 - flight) * 2;
    shadow(ctx, x + 5, 173, 85 - altitude * 0.23, 60 - altitude * 0.27, 0.16 - altitude * 0.0012);
    shadow(ctx, x + 2, 190, 72, 39, 0.20 * Math.exp(-altitude / 9));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.045 + (1 - flight) * -0.26 + Math.sin(Math.PI * rebound) * 0.06);
    const h = Math.max(0.05, radius * Math.abs(cosine));
    // The visible cap switches at the silhouette. Its offset reverses
    // there too, keeping the cylinder continuous through each edge flash.
    const cap = -Math.sign(cosine) * sine * thickness / 2;
    ellipse(ctx, h, -cap);
    ctx.fillStyle = "#acb1b4";
    ctx.strokeStyle = "#43484c";
    ctx.lineWidth = 1.25;
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-radius, -Math.abs(cap), radius * 2, 2 * Math.abs(cap));
    const visibleArc = cap > 0 ? -1 : 1;
    const reflectedLight = 1.95 + 0.55 * sine;
    ctx.lineWidth = 0.85;
    for (let i = 1; i < 60; i++) {
      const a = Math.PI * i / 60;
      const u = radius * Math.cos(a);
      const v = visibleArc * h * Math.sin(a);
      // Neighbouring ridges catch the light together as the silver edge turns.
      ctx.strokeStyle = Math.abs(a - reflectedLight) < 0.34 ? "#f5f6f6" : "#54595c";
      ctx.beginPath();
      ctx.moveTo(u, v - cap);
      ctx.lineTo(u - 0.45 * Math.sin(a), v + cap);
      ctx.stroke();
    }

    ellipse(ctx, h, cap);
    ctx.fillStyle = "#dfe1e2";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.translate(0, cap);
    ctx.scale(1, h / radius);
    const heads = cosine >= 0;
    const face = heads ? art.heads : art.tails;
    if (face) ctx.drawImage(face, -radius, -radius, radius * 2, radius * 2);
    silverReflection(ctx, angle);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 27px Cinzel, Georgia, serif";
    ctx.strokeStyle = "#f3f4f4";
    ctx.lineWidth = 2;
    ctx.strokeText(heads ? "1" : "2", 0, 51);
    ctx.fillStyle = "#24282b";
    ctx.fillText(heads ? "1" : "2", 0, 51);
    ctx.restore();
    ellipse(ctx, h, cap);
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = "#494d50";
    ctx.stroke();
    ctx.restore();
  }

  window.RandomCoin = { draw };
})();
