export type MediaTone = "light" | "dark";

export async function estimateMediaTone(
  documentRef: Document,
  url: string,
  media: HTMLVideoElement | HTMLImageElement | null
): Promise<MediaTone | null> {
  const source = media || await loadToneImage(url);
  if (source instanceof HTMLVideoElement && source.readyState < 2) {
    await new Promise((resolve) => source.addEventListener("loadeddata", resolve, { once: true }));
  }
  const canvas = documentRef.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = (pixels[index + 3] ?? 0) / 255;
    if (alpha < 0.2) continue;
    total += (
      0.2126 * (pixels[index] ?? 0) +
      0.7152 * (pixels[index + 1] ?? 0) +
      0.0722 * (pixels[index + 2] ?? 0)
    ) * alpha;
    count += alpha;
  }
  if (!count) return null;
  return total / count > 150 ? "light" : "dark";
}

function loadToneImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
