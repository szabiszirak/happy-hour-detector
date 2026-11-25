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
