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

type DeviceOrItem = { image: string; id?: string | number; [key: string]: any };

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
    } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(item)) {
      images.push(toWebPath(relative(rootDir, fullPath)));
    }
  }
  return images;
}

function escapeHTML(s: string) {
  return s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}

function getDeviceSummary(d: DeviceOrItem): string {
  // Короткая подпись для спойлера
  const parts: string[] = [];
  if (d.Title) parts.push(String(d.Title));
  // if (!parts.length && d.Key) parts.push(String(d.Key));
  if (d.PrefabHash) parts.push(`${d.PrefabHash}`);
  // if (d.id !== undefined && d.id !== null) parts.push(`id: ${d.id}`);
  return parts.length ? parts.join(" | ") : "Device";
}

export async function loadDevicesByImage(languagesRoot: string) {
  // Для дедупликации по id собираем промежуточные "корзины"
  const buckets = new Map<
    string,
    { byId: Map<string, DeviceOrItem>; noId: DeviceOrItem[] }
  >();

  const all: { data: DeviceOrItem; imageKey: string; source: string }[] = [];

  let totalDuplicatesById = 0;
  const duplicatesPerImage = new Map<string, number>();

  for (const file of ["devices.json", "items.json"]) {
    let json: any;
    try {
      json = await Bun.file(join(languagesRoot, file)).json();
    } catch {
      continue;
    }

    // Поддержка форматов: { data: [...] } или просто [...]
    const entries: DeviceOrItem[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];

    for (const entry of entries) {
      if (!entry || !entry.image) continue;

      const key = String(entry.image)
        .replace(/^\/?images\//, "")
        .replace(/\\/g, "/");

      all.push({ data: entry, imageKey: key, source: file });

      if (!buckets.has(key)) {
        buckets.set(key, { byId: new Map(), noId: [] });
      }
      const bucket = buckets.get(key)!;

      const hasId = entry.id !== undefined && entry.id !== null;
      if (hasId) {
        const idStr = String(entry.id);
        if (bucket.byId.has(idStr)) {
          // Дубликат по id для этой картинки — пропускаем
          totalDuplicatesById++;
          duplicatesPerImage.set(key, (duplicatesPerImage.get(key) || 0) + 1);
        } else {
          // Сохраняем первый встретившийся (приоритет devices.json, потом items.json)
          bucket.byId.set(idStr, entry);
        }
      } else {
        // Записи без id оставляем как есть (их не с чем дедуплицировать по id)
        bucket.noId.push(entry);
      }
    }
  }

  // Собираем финальную карту image -> устройства (уникальные по id)
  const imageToDevices = new Map<string, DeviceOrItem[]>();
  for (const [key, bucket] of buckets) {
    // Сохраняем стабильный порядок: сначала устройства с id (как Map insertion order), затем без id
    const arr = [...bucket.byId.values(), ...bucket.noId];
    imageToDevices.set(key, arr);
  }

  return {
    imageToDevices,
    all,
    dedupStats: {
      totalDuplicatesById,
      duplicatesPerImage,
    },
  };
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
  const imagesSet = new Set(imagesRel.map(toWebPath));

  const { imageToDevices, all, dedupStats } =
    await loadDevicesByImage(languagesDir);

  // Собираем данные для шаблона (на всякий случай повторно гарантим уникальность по id)
  const images = imagesRel.map((imageRel) => {
    const normRel = toWebPath(imageRel);
    const devices = imageToDevices.get(normRel) ?? [];

    const seenIds = new Set<string>();
    const finalDevices = devices.filter((d) => {
      if (d.id === undefined || d.id === null) return true;
      const idStr = String(d.id);
      if (seenIds.has(idStr)) return false;
      seenIds.add(idStr);
      return true;
    });

    const devicesPrepared = finalDevices.map((d) => ({
      summary: getDeviceSummary(d),
      json: escapeHTML(JSON.stringify(d, null, 2)),
      data: d,
    }));

    return {
      normRel,
      imgSrc: toWebPath(`${basePath}${normRel}`),
      devices: devicesPrepared,
      devicesCount: devicesPrepared.length,
    };
  });

  // Рендерим EJS-шаблон
  const html = await ejs.renderFile(templatePath, {
    title,
    images,
  });

  await writeFile(join(outputDir, "index.html"), html, "utf-8");

  // Подробный отчет в конце скрипта
  const totalImages = imagesRel.length;
  const totalDevicesLoaded = all.length;

  const mappedDevices = all.filter((e) => imagesSet.has(e.imageKey)).length;
  const orphanDevices = all.filter((e) => !imagesSet.has(e.imageKey));

  let imagesWith0 = 0;
  let imagesWith1 = 0;
  let imagesWithMany = 0;
  const ambiguous: { key: string; count: number }[] = [];

  for (const key of imagesSet) {
    const count = imageToDevices.get(key)?.length ?? 0;
    if (count === 0) imagesWith0++;
    else if (count === 1) imagesWith1++;
    else {
      imagesWithMany++;
      ambiguous.push({ key, count });
    }
  }

  ambiguous.sort((a, b) => b.count - a.count);

  console.log("========== Gallery generation report ==========");
  console.log(`Title: ${title}`);
  console.log(`Images dir: ${imageDir}`);
  console.log(`Output dir: ${outputDir}`);
  console.log(`Languages dir: ${languagesDir}`);
  console.log("");
  console.log(`Total images found: ${totalImages}`);
  console.log(`Total device entries loaded: ${totalDevicesLoaded}`);
  console.log(`Device entries linked to existing images: ${mappedDevices}`);
  console.log(
    `Device entries referencing missing images (orphans): ${orphanDevices.length}`,
  );
  console.log("");
  console.log(`Images with 0 devices: ${imagesWith0}`);
  console.log(`Images with 1 device: ${imagesWith1}`);
  console.log(`Images with >1 devices: ${imagesWithMany}`);
  console.log("");
  console.log(
    `Duplicates by id removed (total): ${dedupStats.totalDuplicatesById}`,
  );
  if (dedupStats.duplicatesPerImage.size > 0) {
    const top = [...dedupStats.duplicatesPerImage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    if (top.length) {
      console.log("Images with most duplicates removed (top 30):");
      for (const [key, count] of top) {
        console.log(`  - ${key}: ${count} duplicate(s) removed`);
      }
    }
  }
  if (ambiguous.length) {
    console.log("");
    console.log("Images with multiple devices after dedupe (top 30):");
    for (const { key, count } of ambiguous.slice(0, 30)) {
      console.log(`  - ${key}: ${count} devices`);
    }
  }
  if (orphanDevices.length) {
    console.log("");
    console.log("Orphan device entries (first 30):");
    for (const o of orphanDevices.slice(0, 30)) {
      console.log(`  - ${o.imageKey} (from ${o.source})`);
    }
  }
  console.log("===============================================");
}
