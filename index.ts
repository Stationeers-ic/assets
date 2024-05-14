import Bun, { $ } from "bun";
import {
  copyFile as copy,
  mkdir,
  rename,
  rmdir,
  writeFile as write,
} from "node:fs/promises";
import { cpus } from "node:os";
import { basename, dirname, join } from "path";
import { dir_index, walkDir } from "./tools/dir_index";
import type {
  Device,
  Devices,
  Items,
  OldDevices,
  ReagentItem,
  Reagents,
} from "./tools/types";

console.info("Start building...");

const GODPromise: Promise<any>[] = [];

async function clearDist() {
  console.time("Clear DIST");
  await rmdir("./dist", { recursive: true });
  console.timeEnd("Clear DIST");
}

async function optimizeImages() {
  // const x = (cpus().length + 1) >> 1;
  let x = cpus().length - 1;
  if (x < 1) x = 1;
  console.log("Optimize images using", x, "cores");
  console.time("Optimize images");
  await $`tools/oxipng -o max --strip safe --alpha ./source/images -r -q -t ${x} --dir ./dist/images`;
  console.timeEnd("Optimize images");
}

async function moveImages() {
  console.log("move images");
  console.time("move images");
  const distImages = new Bun.Glob("./dist/**/*.png");
  const moves: Promise<void>[] = [];
  for await (const file of distImages.scan(".")) {
    const name = basename(file);
    const dir = join(__dirname, "dist", findImage(name));
    moves.push(moveFile(file, dirname(dir)));
  }
  await Promise.all(moves);
  console.timeEnd("move images");
}

async function moveFiles() {
  console.log("move other files");
  console.time("move other files");
  const moves: Promise<void>[] = [
    copyJSON("source/languages/EN/colors.json", "./dist"),
    copyJSON("source/languages/EN/consts.json", "./dist"),
  ];
  const languages = new Bun.Glob("**/{constants,instructions}.json");
  for await (const file of languages.scan("source/languages")) {
    moves.push(
      copyJSON(
        join("source", "languages", file),
        join("dist", "languages", dirname(file)),
      ),
    );
  }
  await Promise.all(moves);
  console.timeEnd("move other files");
}

async function moveData() {
  console.log("move data files");
  console.time("move data files");
  const languages = new Bun.Glob("**/data.json");
  const moves: Promise<void>[] = [];
  for await (const file of languages.scan("source/languages")) {
    const sFile = Bun.file(join("source", "languages", file));
    moves.push(
      sFile.json().then(async (json) => {
        const result = strip(json);
        await write(join("dist", "languages", file), JSON.stringify(result));
      }),
    );
  }
  await Promise.all(moves);
  console.timeEnd("move data files");
}

async function optimizeData() {
  //optimize data
  const languages = new Bun.Glob("**/data.json");
  for await (const file of languages.scan("./dist/languages/")) {
    try {
      const [languages, name] = [dirname(file), basename(file)];
      // if (languages.length !== 2) continue
      if (name !== "data.json") continue;
      const sFile = Bun.file(join("source", "languages", file));
      const data = (await sFile.json()) as OldDevices;
      // const data = require() as OldDevices
      //OldDevice to Device TODO images
      const devices: Devices = { data: [], images: {} };
      const items: Items = { data: [] };
      const reagents: Reagents = { data: [] };
      const logics: any = { data: [] };

      const oldDevices = Object.entries(data);
      oldDevices
        .filter(([key, oldDevice]) => {
          if (oldDevice.tags.includes("item")) return true;
          if (!oldDevice.PrefabName) return true;
          if (!oldDevice.MainImage) return true;
          if (!oldDevice.tags.includes("hasLogic")) return true;
          let hasChip = false;
          if (oldDevice.tags.includes("hasChip")) hasChip = true;
          const logics: {
            name: string;
            permissions: string[];
          }[] = [];
          for (const logic of oldDevice.LogicInsert) {
            const logicName = logic.LogicName.replace(/<[^>]*>?/gm, "");
            const permissions = logic.LogicAccessTypes.split(" ");
            logics.push({
              name: logicName,
              permissions: permissions,
            });
          }
          const slots: {
            SlotName: string;
            SlotType: string;
            SlotIndex: number;
            logic: string[];
          }[] = [];
          const slotLogic: Record<number, string[]> = {};
          oldDevice.LogicSlotInsert.forEach((sl) => {
            const logicName = sl.LogicName.replace(/<[^>]*>?/gm, "");
            const slotIndexs = sl.LogicAccessTypes.split(", ").map((index) =>
              Number(index),
            );
            slotIndexs.forEach((index) => {
              if (!slotLogic[index]) slotLogic[index] = [];
              slotLogic[index].push(logicName);
            });
          });
          oldDevice.SlotInserts.forEach((slot) => {
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
            id: oldDevice.PrefabHash,
            Title: oldDevice.Title ?? key,
            Key: key,
            PrefabName: oldDevice.PrefabName,
            PrefabHash: oldDevice.PrefabHash,
            hasChip: hasChip,
            deviceConnectCount: oldDevice.DeviceConnectCount ?? 0,
            image: findImage(oldDevice.MainImage),
            mods: oldDevice.ModeInsert.map((mod) => mod.LogicName),
            connections: oldDevice.ConnectionInsert.map(
              (connection) => connection.LogicName,
            ),
            slots: slots,
            tags: oldDevice.tags,
            logics: logics,
          };
          devices.data.push(device);
          return true;
        })
        .filter(([key, oldDevice]) => {
          //Здесь остались только item
          if (!oldDevice.tags.includes("item")) return true;
          if (!oldDevice.MainImage) return true;
          if (!oldDevice.PrefabName) return true;

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
        })
        .filter(([key, oldDevice]) => {
          //Здесь остались только item
          if (oldDevice.TYPE !== "reagent") return true;
          if (!oldDevice.MainImage) return true;
          if (!oldDevice.Title) return true;

          const reagentItems: ReagentItem[] = [];

          oldDevice.FoundInOre.forEach((item) => {
            const name = item.NameOfThing.replaceAll(/<[^>]*>?/gm, "");

            const itemData = oldDevices.find(
              ([key, oldDevice]) => oldDevice.Title === name,
            );
            if (!itemData) return null;
            if (!itemData[1].Title) return null;
            if (!itemData[1].PrefabName) return null;
            if (!itemData[1].MainImage) return null;
            if (!itemData[1].PrefabHash) return null;
            reagentItems.push({
              title: itemData[1].Title,
              name: itemData[1].PrefabName,
              hash: itemData[1].PrefabHash,
              count: isNaN(Number(item.QuantityOfThing))
                ? 0
                : Number(item.QuantityOfThing),
              image: findImage(itemData[1].MainImage),
            });
          });

          reagents.data.push({
            title: oldDevice.Title ?? "",
            name: key,
            hash: oldDevice.ReagentsHash ?? oldDevice.PrefabHash,
            image: findImage(oldDevice.MainImage),
            items: reagentItems,
          });
        })
        .filter(([key, oldDevice]) => {
          //Здесь остались только item
          if (!oldDevice.Key.startsWith("LogicType")) return true;

          const reagentItems: ReagentItem[] = [];

          logics.data.push({
            key: key,
            name: oldDevice.Title,
            description: oldDevice.Description,
          });
        });
      devices.data.sort((a, b) => a.Key.localeCompare(b.Key));
      items.data.sort((a, b) => a.Key.localeCompare(b.Key));
      await writeFile(
        "devices.json",
        join("dist", "languages", languages),
        devices,
      );
      await writeFile(
        "items.json",
        join("dist", "languages", languages),
        items,
      );
      await writeFile(
        "reagents.json",
        join("dist", "languages", languages),
        reagents,
      );
      await writeFile(
        "logics.json",
        join("dist", "languages", languages),
        logics,
      );
    } catch (e) {
      console.error(e);
    }
  }
}

async function generateIndex() {
  process.chdir(join(__dirname, "dist"));
  const promises: Promise<void>[] = [];
  // Использование:
  promises.push(dir_index(join(__dirname, "dist"), ""));
  walkDir("./", function (dirPath: string) {
    promises.push(dir_index(join(__dirname, "dist"), dirPath));
  }).catch(console.error);

  return await Promise.all(promises);
}

await clearDist();
GODPromise.push(optimizeImages().then(() => moveImages()));
GODPromise.push(moveFiles());
GODPromise.push(moveData());
await Promise.all(GODPromise);
await optimizeData();
await generateIndex();
//----------------------------------------------HELPERS----------------------------------------------
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
      if (Object.keys(v).length === 0) return;
      newO[k] = v;
    });
    r[key] = newO;
  });
  return r;
}
async function writeFile(file: string, dir: string, content?: {}) {
  await mkdir(dir, { recursive: true });
  return write(join(dir, file), JSON.stringify(content), {
    encoding: "utf-8",
  });
}
async function moveFile(file: string, dir: string, newName?: string) {
  await mkdir(dir, { recursive: true });
  return rename(file, join(dir, newName ?? basename(file)));
}
async function copyFile(file: string, dir: string, newName?: string) {
  await mkdir(dir, { recursive: true });
  return copy(file, join(dir, newName ?? basename(file)));
}
async function copyJSON(file: string, dir: string, newName?: string) {
  const mk = mkdir(dir, { recursive: true });
  const sFile = Bun.file(file);
  const json = await sFile.json();
  await mk;
  return write(join(dir, newName ?? basename(file)), JSON.stringify(json), {
    encoding: "utf-8",
  });
  // return copy(file, join(dir, newName ?? basename(file)))
}
