// Böngészős segéd: képből kicsinyített JPEG data URL (demó módhoz, hogy a localStorage-ba beférjen).

export async function imagePreview(file: File, maxSide = 640, quality = 0.72): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) return undefined;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return undefined;
  }
}

export const randomId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Négyzetes, középre vágott profilkép (alapból 256×256 JPEG) data URL-ként. */
export async function squareAvatar(file: File, side = 256, quality = 0.82, background = "#14181A"): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, side, side);
    bmp.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return undefined;
  }
}

/** data URL → Blob (feltöltéshez). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
