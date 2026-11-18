function readImage(payload) {
  if (payload === null) return null;
  if (typeof payload !== "string" || payload.length > 5_600_000)
    throw new Error("INVALID_IMAGE");
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      payload,
    );
  if (!match) throw new Error("INVALID_IMAGE");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 4 * 1024 * 1024 || bytes.length < 32)
    throw new Error("INVALID_IMAGE");
  const mime = match[1];
  let dimensions;
  if (
    mime === "image/png" &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  )
    dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  else if (
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    dimensions = jpegDimensions(bytes);
  else if (
    mime === "image/webp" &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 <= bytes.length
  )
    dimensions = webpDimensions(bytes);
  if (
    !dimensions ||
    dimensions.some((value) => !value || value > 8192) ||
    dimensions[0] * dimensions[1] > 32_000_000
  )
    throw new Error("INVALID_IMAGE");
  return { bytes, mime };
}
function jpegDimensions(bytes) {
  let index = 2;
  while (index + 4 < bytes.length) {
    if (bytes[index++] !== 255) return null;
    while (bytes[index] === 255) index++;
    const marker = bytes[index++];
    if (marker === 217 || marker === 218) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (index + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(index);
    if (length < 2 || index + length > bytes.length) return null;
    if (
      [
        192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
      ].includes(marker)
    ) {
      if (length < 7) return null;
      return [bytes.readUInt16BE(index + 5), bytes.readUInt16BE(index + 3)];
    }
    index += length;
  }
  return null;
}
function webpDimensions(bytes) {
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8X" && bytes.length >= 30)
    return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
  if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 47) {
    const bits = bytes.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
  }
  if (
    kind === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 157 &&
    bytes[24] === 1 &&
    bytes[25] === 42
  )
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  return null;
}
function sendImage(res, bytes, mime) {
  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(bytes);
}
module.exports = { readImage, sendImage };
