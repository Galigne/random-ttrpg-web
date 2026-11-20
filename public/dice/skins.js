// The account settings and renderer share these stable texture IDs.
(() => {
  const skins = {
    marble: { en: "Ivory marble", fr: "Marbre ivoire", color: "#e8daca", ink: "#292b2e" },
    garnet: { en: "Ember garnet", fr: "Grenat de braise", color: "#cf3944", ink: "#fff0de" },
    lapis: { en: "Tidal lapis", fr: "Lapis des marées", color: "#386ccf", ink: "#fff3d9" },
    iron: { en: "Engraved iron", fr: "Fer gravé", color: "#87939f", ink: "#e3e1e6", finish: "silver-rim" },
  };
  function resolve(appearance) {
    const id = Object.hasOwn(skins, appearance?.skin) ? appearance.skin : "marble";
    const skin = skins[id];
    const glow = /^#[0-9a-f]{6}$/i.test(appearance?.glow) ? appearance.glow : skin.color;
    return { id, ink: skin.ink, glow, finish: skin.finish };
  }

  const grainTiles = new WeakMap();
  function castGrain(texture) {
    if (grainTiles.has(texture)) return grainTiles.get(texture);
    // Sample an undecorated patch of hammered metal from the original iron swatch.
    const tile = document.createElement("canvas");
    tile.width = tile.height = 16;
    const scale = texture.naturalWidth / 512;
    tile.getContext("2d").drawImage(texture, 166 * scale, 28 * scale, 24 * scale, 24 * scale, 0, 0, 16, 16);
    grainTiles.set(texture, tile);
    return tile;
  }

  function ironFace(ctx, art, radius, brightness) {
    const shade = Math.round(48 + 32 * brightness);
    ctx.fillStyle = `rgb(${shade},${shade - 1},${shade + 5})`;
    ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);

    // The current path is the original face perimeter, clipped on its inside.
    // Stroke in face coordinates so even a receding edge has the correct width.
    const rim = ctx.createLinearGradient(-radius * .65, -radius * .48, radius * .56, radius * .62);
    rim.addColorStop(0, "#9998a1");
    rim.addColorStop(.27, "#e2e1e4");
    rim.addColorStop(.48, "#a9a7af");
    rim.addColorStop(.76, "#777681");
    rim.addColorStop(1, "#c8c7cb");
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#25232a";
    ctx.lineWidth = 11.5;
    ctx.stroke();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 8.5;
    ctx.globalAlpha = .62 + .38 * brightness;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(249,248,250,${.35 + brightness * .36})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (art.texture?.naturalWidth) {
      ctx.fillStyle = ctx.createPattern(castGrain(art.texture), "repeat");
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = .24;
      ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 8.5;
      ctx.globalAlpha = .55;
      ctx.stroke();
    }
  }

  function paintTexture(ctx, face, art, radius, brightness) {
    ctx.save();
    if (art?.finish === "silver-rim") ironFace(ctx, art, radius, brightness);
    else {
      const texture = art?.texture || art;
      if (texture?.naturalWidth) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = .92;
        ctx.transform(...face.marble);
        ctx.drawImage(texture, 0, 0, 1, 1);
      }
    }
    ctx.restore();
  }

  function halo(ctx, x, y, color, strength) {
    const light = ctx.createRadialGradient(x, y, 48, x, y, 121);
    light.addColorStop(0, color);
    light.addColorStop(.54, color + "cf");
    light.addColorStop(1, color + "00");
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.fillStyle = light;
    ctx.fillRect(x - 121, y - 121, 242, 242);
    ctx.restore();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = skins;
  else window.RandomDiceMaterials = { skins, resolve, halo, paintTexture, castGrain };
})();
