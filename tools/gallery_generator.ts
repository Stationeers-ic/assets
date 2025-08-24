import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "path";

export interface GalleryOptions {
  imageDir: string;
  outputDir: string;
  title?: string;
  basePath?: string;
  languagesDir?: string;
}

type DeviceOrItem = { image: string; [key: string]: any };

export async function generateGallery(options: GalleryOptions) {
  const {
    imageDir,
    outputDir,
    title = "Image Gallery",
    basePath = "/images/",
    languagesDir = resolve(outputDir, "../languages/EN"),
  } = options;

  const images = await findImages(imageDir, imageDir);
  const deviceMap = await loadDevicesByImage(languagesDir);
  const html = generateHTML(images, title, basePath, deviceMap);
  await writeFile(join(outputDir, "index.html"), html, "utf-8");
}

function toWebPath(p: string) {
  return p.replace(/\\/g, "/");
}

async function findImages(
  rootDir: string,
  currentDir: string
): Promise<string[]> {
  const items = await readdir(currentDir);
  const images: string[] = [];

  for (const item of items) {
    const fullPath = join(currentDir, item);
    const fileStat = await stat(fullPath);

    if (fileStat.isDirectory()) {
      images.push(...(await findImages(rootDir, fullPath)));
    } else if (/\.(png|jpe?g|gif|webp)$/i.test(item)) {
      images.push(toWebPath(relative(rootDir, fullPath)));
    }
  }
  return images;
}

export async function loadDevicesByImage(languagesRoot: string) {
  const map = new Map<string, DeviceOrItem>();

  for (const file of ["devices.json", "items.json"]) {
    const { data }: { data: DeviceOrItem[] } = await Bun.file(
      join(languagesRoot, file)
    ).json();
    for (const entry of data) {
      if (entry.image) {
        const key = entry.image.replace(/^\/?images\//, "");
        map.set(key, entry);
      }
    }
  }
  return map;
}

function escapeHTML(s: string) {
  return s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
  );
}

function deviceDetailsBlock(device: DeviceOrItem | undefined): string {
  if (!device) return "";
  return `
    <details>
      <summary>Data JSON</summary>
      <pre class="json"><code lang="json">${escapeHTML(JSON.stringify(device, null, 2))}</code></pre>
    </details>
  `;
}

function generateHTML(
  images: string[],
  title: string,
  basePath: string,
  deviceMap: Map<string, DeviceOrItem>
): string {
    const preload:string[] = []
  const itemsHTML = images
    .map((imageRel) => {
      const normRel = toWebPath(imageRel);
      const device = deviceMap.get(normRel);
      const imgSrc = toWebPath(`${basePath}${normRel}`);
      return `
      <div class="gallery-item">
        <div class="img-bg">
        <img src="${imgSrc}" alt="${normRel}" loading="lazy" width="128" height="128">
        </div>
        <p>${normRel}</p>
        ${deviceDetailsBlock(device)}
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background-color: #f0f0f0;
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 15px;
      padding: 20px;
    }
    .gallery-item {
      background: white;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: left;
    }
    .img-bg {
        padding: 5px;
        width: 128px;
        height: 128px;
        margin: 0 auto;
        border-radius: 3px;
        background-color: #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .img-bg img {
        padding: 5px;
        width: 128px;
        height: 128px;
        object-fit: contain;
        display: block;
        border-radius: 3px;
        background: none;
        border: 1px solid #888;
        box-shadow: 0 2px 8px rgba(0,0,0,0.10);
    }
    .gallery-item p {
      margin: 10px 0 8px;
      font-size: 14px;
      word-break: break-all;
      text-align: center;
    }
    details {
      margin-top: 6px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
    }
    .json {
      background: #f7f7f7;
      padding: 8px;
      border-radius: 4px;
      overflow: auto;
      max-height: 300px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      font-size: 12px;
      line-height: 1.4;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  <div class="gallery">
    ${itemsHTML}
  </div>
</body>
</html>`;
}
