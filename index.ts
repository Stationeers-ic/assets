import Bun, { $ } from "bun";
import {
  copyFile as copy,
  mkdir,
  rename,
  rm,
  writeFile as write,
} from "node:fs/promises";
import { cpus } from "node:os";
import { basename, dirname, join, resolve } from "path";
import { dir_index, walkDir } from "./tools/dir_index";
import type {
  Device,
  Devices,
  Items,
  OldDevices,
  ReagentItem,
  Reagents,
} from "./tools/types";
import type { ConstantMap } from "./types";

console.info("Start building...");

// ---------------------------------------------- CONSTANTS ----------------------------------------------
const ROOT_DIR = __dirname;
const DIST_DIR = join(ROOT_DIR, "dist");
const SRC_DIR = join(ROOT_DIR, "source");
const SRC_LANG_DIR = join(SRC_DIR, "languages");
const DIST_LANG_DIR = join(DIST_DIR, "languages");
const DIST_IMAGES_DIR = join(DIST_DIR, "images");
const DATA_JSON = "data.json";
const PNG_IN_DIST_GLOB = "./dist/images/**/*.png";
const TAGS_REGEX = /<[^>]*>?/gm;

// ---------------------------------------------- UTILS ----------------------------------------------
const stripTags = (s: string) => s.replace(TAGS_REGEX, "");
const ensureDir = (dir: string) => mkdir(dir, { recursive: true });

function cpuWorkers(): number {
  // Используем все, кроме одного ядра. Минимум 1 поток.
  return Math.max(1, cpus().length - 1);
}

// ---------------------------------------------- TASKS ----------------------------------------------
async function clearDist() {
  console.time("Clear DIST");
  await rm(DIST_DIR, { recursive: true, force: true });
  console.timeEnd("Clear DIST");
}

async function optimizeImages() {
  const threads = cpuWorkers();
  console.log("Optimize images using", threads, "cores");
  console.time("Optimize images");
  await $`tools/oxipng -o max --strip safe --alpha ./source/images -r -q -t ${threads} --dir ${DIST_IMAGES_DIR}`;
  console.timeEnd("Optimize images");
}

async function moveImages() {
  console.log("move images");
  console.time("move images");

  const distImages = new Bun.Glob(PNG_IN_DIST_GLOB);
  const moves: Promise<void>[] = [];

  for await (const file of distImages.scan(".")) {
    const name = basename(file);
    const destPath = join(DIST_DIR, findImage(name)); // images/F/Fo/...

    // Если файл уже на своём месте — пропускаем
    if (resolve(file) === resolve(destPath)) continue;

    moves.push(moveFile(file, dirname(destPath), basename(destPath)));
  }

  if (moves.length) await Promise.all(moves);
  console.timeEnd("move images");
}

async function moveFiles() {
  console.log("move other files");
  console.time("move other files");

  const moves: Promise<void>[] = [
    copyJSON(join(SRC_LANG_DIR, "EN/colors.json"), DIST_DIR),
  ];

  // Копируем constants.json и instructions.json для всех языков
  const languages = new Bun.Glob("**/{constants,instructions}.json");
  for await (const relPath of languages.scan(SRC_LANG_DIR)) {
    const src = join(SRC_LANG_DIR, relPath);
    const destDir = join(DIST_LANG_DIR, dirname(relPath));
    moves.push(copyJSON(src, destDir));
  }

  if (moves.length) await Promise.all(moves);
  console.timeEnd("move other files");
}

async function buildConstant() {
  console.time("build consts files");
  const file = (await Bun.file(
    join(SRC_LANG_DIR, "EN/constants.json"),
  ).json()) as ConstantMap;
  const consts: { [key: string]: number | string } = {};
  Object.entries(file).forEach(([_, data]) => {
    consts[data.literal] = data.value;
  });
  await writeFile("consts.json", DIST_DIR, consts);
  console.timeEnd("build consts files");
}

async function moveData() {
  console.log("move data files");
  console.time("move data files");

  const dataGlob = new Bun.Glob(`**/${DATA_JSON}`);
  const moves: Promise<void>[] = [];

  for await (const relPath of dataGlob.scan(SRC_LANG_DIR)) {
    const srcFile = join(SRC_LANG_DIR, relPath);
    const destFile = join(DIST_LANG_DIR, relPath);

    const sFile = Bun.file(srcFile);
    moves.push(
      sFile.json().then(async (json) => {
        const result = strip(json);
        await ensureDir(dirname(destFile));
        await write(destFile, JSON.stringify(result), { encoding: "utf-8" });
      }),
    );
  }

  if (moves.length) await Promise.all(moves);
  console.timeEnd("move data files");
}

async function optimizeData() {
  // Преобразование data.json в структуры devices/items/reagents/logics
  const dataGlob = new Bun.Glob(`**/${DATA_JSON}`);

  for await (const relPath of dataGlob.scan(SRC_LANG_DIR)) {
    try {
      const langDir = dirname(relPath);
      const baseName = basename(relPath);
      if (baseName !== DATA_JSON) continue;

      const srcFile = join(SRC_LANG_DIR, relPath);
      const sFile = Bun.file(srcFile);
      const data = (await sFile.json()) as OldDevices;

      const devices: Devices = { data: [], images: {} };
      const items: Items = { data: [] };
      const reagents: Reagents = { data: [] };
      const logicsCollection: any = { data: [] };

      const entries = Object.entries(data);

      // Devices
      for (const [key, oldDevice] of entries) {
        if (!oldDevice.PrefabName) continue;
        if (!oldDevice.MainImage) continue;
        if (!oldDevice.tags.includes("hasLogic")) continue;

        const hasChip = oldDevice.tags.includes("hasChip");

        // Логика, которую можно вставить в девайс
        const deviceLogics: { name: string; permissions: string[] }[] = [];
        for (const logic of oldDevice?.LogicInsert) {
          const logicName = stripTags(logic.LogicName);
          const permissions = logic.LogicAccessTypes.split(" ");
          deviceLogics.push({ name: logicName, permissions });
        }

        // Слоты и сопоставление логики к слоту
        const slots: {
          SlotName: string;
          SlotType: string;
          SlotIndex: number;
          logic: string[];
        }[] = [];

        const slotLogic: Record<number, string[]> = {};
        oldDevice?.LogicSlotInsert?.forEach((sl) => {
          const logicName = stripTags(sl.LogicName);
          const slotIndices = sl.LogicAccessTypes.split(", ").map(Number);
          for (const index of slotIndices) {
            if (!slotLogic[index]) slotLogic[index] = [];
            slotLogic[index].push(logicName);
          }
        });

        oldDevice?.SlotInserts?.forEach((slot) => {
          const slotName = slot.SlotName;
          const slotType = slot.SlotType;
          const slotIndex = Number(slot.SlotIndex);

          if (slot.image) {
            devices.images[`SlotType.${slotType}`] = findImage(slot.image);
          }

          slots.push({
            SlotName: slotName,
            SlotType: slotType,
            SlotIndex: slotIndex,
            logic: slotLogic[slotIndex] ?? [],
          });
        });

        const device: Device = {
          id: oldDevice?.PrefabHash,
          Title: oldDevice?.Title ?? key,
          Key: key,
          PrefabName: oldDevice?.PrefabName,
          PrefabHash: oldDevice?.PrefabHash,
          hasChip,
          deviceConnectCount: oldDevice.DeviceConnectCount ?? 0,
          image: findImage(oldDevice.MainImage),
          mods: oldDevice?.ModeInsert?.map((mod) => mod.LogicName),
          connections: oldDevice?.ConnectionInsert?.map(
            (connection) => connection?.LogicName,
          ),
          slots,
          tags: oldDevice?.tags,
          logics: deviceLogics,
        };

        devices.data.push(device);
      }

      // Items
      for (const [key, oldDevice] of entries) {
        if (!oldDevice.tags.includes("item")) continue;
        if (!oldDevice.MainImage) continue;
        if (!oldDevice.PrefabName) continue;

        items.data.push({
          id: oldDevice.PrefabHash,
          Title: oldDevice.Title ?? key,
          Key: key,
          PrefabName: oldDevice.PrefabName,
          PrefabHash: oldDevice.PrefabHash,
          StackSize: Number(oldDevice.StackSizeText),
          image: findImage(oldDevice.MainImage),
          tags: oldDevice.tags,
        });
      }

      // Reagents
      for (const [key, oldDevice] of entries) {
        if (oldDevice.TYPE !== "reagent") continue;
        if (!oldDevice.MainImage) continue;
        if (!oldDevice.Title) continue;

        const reagentItems: ReagentItem[] = [];

        oldDevice.FoundInOre.forEach((item) => {
          const name = stripTags(item.NameOfThing);

          const itemData = entries.find(([, dev]) => dev.Title === name);
          if (!itemData) return;
          const [, found] = itemData;

          if (!found.Title) return;
          if (!found.PrefabName) return;
          if (!found.MainImage) return;
          if (!found.PrefabHash) return;

          reagentItems.push({
            title: found.Title,
            name: found.PrefabName,
            hash: found.PrefabHash,
            count: isNaN(Number(item.QuantityOfThing))
              ? 0
              : Number(item.QuantityOfThing),
            image: findImage(found.MainImage),
          });
        });

        reagents.data.push({
          title: oldDevice.Title ?? "",
          name: key,
          hash: oldDevice.ReagentsHash ?? oldDevice.PrefabHash,
          image: findImage(oldDevice.MainImage),
          items: reagentItems,
        });
      }

      // Logics
      for (const [key, oldDevice] of entries) {
        if (!oldDevice.Key.startsWith("LogicType")) continue;

        logicsCollection.data.push({
          key,
          name: oldDevice.Title,
          description: oldDevice.Description,
        });
      }

      devices.data.sort((a, b) => a.Key.localeCompare(b.Key));
      items.data.sort((a, b) => a.Key.localeCompare(b.Key));

      await writeFile("devices.json", join(DIST_LANG_DIR, langDir), devices);
      await writeFile("items.json", join(DIST_LANG_DIR, langDir), items);
      await writeFile("reagents.json", join(DIST_LANG_DIR, langDir), reagents);
      await writeFile(
        "logics.json",
        join(DIST_LANG_DIR, langDir),
        logicsCollection,
      );
    } catch (e) {
      console.error(e);
    }
  }
}

async function generateIndex() {
  process.chdir(DIST_DIR);

  const promises: Promise<void>[] = [];
  // Индекс для корня dist
  promises.push(dir_index(DIST_DIR, ""));

  // Проходим по всем подкаталогам и генерируем индексы
  const walkPromise = walkDir("./", (dirPath: string) => {
    promises.push(dir_index(DIST_DIR, dirPath));
  }).catch(console.error);

  // Ждем окончания обхода, чтобы гарантированно собрать все промисы индексации
  await walkPromise;
  return Promise.all(promises);
}

// ---------------------------------------------- RUN ----------------------------------------------
await clearDist();
const BUILD_TASKS: Promise<any>[] = [];
BUILD_TASKS.push(moveFiles());
BUILD_TASKS.push(moveData());
BUILD_TASKS.push(buildConstant());
BUILD_TASKS.push(optimizeImages().then(() => moveImages()));

await Promise.all(BUILD_TASKS);
await optimizeData();
await generateIndex();

// ---------------------------------------------- HELPERS ----------------------------------------------
function findImage(fileName: string): string;
function findImage(fileName: null): null;
function findImage(fileName: string | null): string | null {
  if (!fileName) return null;
  if (fileName.includes("/") || fileName.includes("\\")) return fileName;
  const firstLetter = fileName[0];
  const secondLetter = fileName[1];
  return join("images", firstLetter, secondLetter, fileName);
}

function strip(
  obj: Record<string, Record<string, any>>,
): Record<string, Record<string, any>> {
  const r: Record<string, any> = {};
  Object.entries(obj).forEach(([key, o]) => {
    const newO: Record<string, any> = {};
    Object.entries(o).forEach(([k, v]) => {
      if (v === null) return;
      if (v === undefined) return;
      if (v === "") return;
      if (Array.isArray(v) && v.length === 0) return;
      if (
        typeof v === "object" &&
        v !== null &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      )
        return;
      newO[k] = v;
    });
    r[key] = newO;
  });
  return r;
}

async function writeFile(file: string, dir: string, content?: {}) {
  await ensureDir(dir);
  return write(join(dir, file), JSON.stringify(content), {
    encoding: "utf-8",
  });
}

async function moveFile(file: string, dir: string, newName?: string) {
  await ensureDir(dir);
  const dest = join(dir, newName ?? basename(file));

  try {
    await rename(file, dest);
  } catch (err: any) {
    // EEXIST — цель уже есть; EPERM/EXDEV — типичные проблемы Windows/других дисков
    if (
      err?.code === "EEXIST" ||
      err?.code === "EPERM" ||
      err?.code === "EXDEV"
    ) {
      try {
        await rm(dest, { force: true });
      } catch {}
      try {
        await rename(file, dest);
      } catch {
        await copy(file, dest);
        await rm(file, { force: true });
      }
    } else {
      throw err;
    }
  }
}

async function copyFile(file: string, dir: string, newName?: string) {
  await ensureDir(dir);
  return copy(file, join(dir, newName ?? basename(file)));
}

async function copyJSON(file: string, dir: string, newName?: string) {
  const mk = ensureDir(dir);
  const sFile = Bun.file(file);
  const json = await sFile.json();
  await mk;
  return write(join(dir, newName ?? basename(file)), JSON.stringify(json), {
    encoding: "utf-8",
  });
}
