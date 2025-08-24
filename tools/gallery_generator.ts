import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "path";
import ejs from "ejs";

export interface GalleryOptions {
  imageDir: string;
  outputDir: string;
  title?: string;
  basePath?: string;
  languagesDir?: string;
  templatePath?: string; // путь к gallery.ejs
}

type DeviceOrItem = { image: string; [key: string]: any };

function toWebPath(p: string) {
  return p.replace(/\\/g, "/");
}

async function findImages(
  rootDir: string,
  currentDir: string,
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
      join(languagesRoot, file),
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
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}

export async function generateGallery(options: GalleryOptions) {
  const {
    imageDir,
    outputDir,
    title = "Image Gallery",
    basePath = "/images/",
    languagesDir = resolve(outputDir, "../languages/EN"),
    templatePath = resolve(__dirname, "gallery.ejs"),
  } = options;

  const imagesRel = await findImages(imageDir, imageDir);
  const deviceMap = await loadDevicesByImage(languagesDir);

  // Собираем данные для шаблона
  const images = imagesRel.map((imageRel) => {
    const normRel = toWebPath(imageRel);
    const device = deviceMap.get(normRel);
    return {
      normRel,
      imgSrc: toWebPath(`${basePath}${normRel}`),
      device,
      deviceJson: device ? escapeHTML(JSON.stringify(device, null, 2)) : "",
    };
  });

  // Рендерим EJS-шаблон
  const html = await ejs.renderFile(templatePath, {
    title,
    images,
  });

  await writeFile(join(outputDir, "index.html"), html, "utf-8");
}
