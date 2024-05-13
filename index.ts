import Bun, { $ } from "bun";
import { copyFile as copy, mkdir, rename, rmdir, writeFile as write } from "node:fs/promises";
import { basename, join } from "path";
import type { Device, Devices, Items, OldDevices, ReagentItem, Reagents } from "./tools/types";

console.info("Start building...");

const GODPromise: Promise<any>[] = [];

async function step0() {
	console.time("Clear DIST");
	await rmdir("./dist", { recursive: true });
	console.timeEnd("Clear DIST");
}

async function step1() {
	console.time("Optimize images");
	await $`tools/oxipng -o max --strip safe --alpha ./images -r -q -t 8 --dir ./dist/images`;
	console.timeEnd("Optimize images");
}

async function step2() {
	console.time("move images");
	const distImages = new Bun.Glob("./dist/**/*.png");
	for await (const file of distImages.scan(".")) {
		const name = basename(file);
		const dir = join(__dirname, "dist", findImage(name));
		GODPromise.push(moveFile(file, dir));
	}
	console.timeEnd("move images");
}

async function step3() {
	console.time("move other files");
	await copyFile("./EN/colors.json", "./dist");
	await copyFile("./EN/consts.json", "./dist");
	const languages = new Bun.Glob("**/*.json");
	for await (const file of languages.scan(".")) {
		const [languages, name] = file.split("/");
		if (languages.length !== 2) continue;
		switch (name) {
			case "constants.json":
			case "data.json":
			case "instructions.json":
				GODPromise.push(copyFile(file, `./dist/${languages}`));
		}
	}
	console.timeEnd("move other files");
}

async function optimizeData() {
	//optimize data

	const languages = new Bun.Glob("**/data.json");
	for await (const file of languages.scan("./dist")) {
		console.log(file);
		const [languages, name] = file.split("/");
		if (languages.length !== 2) continue;
		if (name !== "data.json") continue;
		const data = require(join(__dirname, "dist", file)) as OldDevices;
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
					const slotIndexs = sl.LogicAccessTypes.split(", ").map((index) => Number(index));
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
					connections: oldDevice.ConnectionInsert.map((connection) => connection.LogicName),
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
				if (oldDevice.TYPE !== 'reagent') return true;
				if (!oldDevice.MainImage) return true;

                const reagentItems:ReagentItem[] = [];

                oldDevice.FoundInOre.forEach((item) => {
                    const name = item.NameOfThing.replaceAll(/<[^>]*>?/gm, "")
                    
                    const itemData = oldDevices.find(([key, oldDevice]) => oldDevice.Title === name)
                    if(!itemData) return null
                    if(!itemData[1].Title) return null
                    if(!itemData[1].PrefabName) return null
                    if(!itemData[1].MainImage) return null
                    if(!itemData[1].PrefabHash) return null
                    reagentItems.push({
                        title: itemData[1].Title,
                        name: itemData[1].PrefabName,
                        hash: itemData[1].PrefabHash,
                        count: Number(item.QuantityOfThing) ?? 0,
                        image: findImage(itemData[1].MainImage)
                    });
                })
                
				reagents.data.push({
					title: oldDevice.Title,
					name: key,
					hash: oldDevice.PrefabHash,
					image: findImage(oldDevice.MainImage),
					items: reagentItems,
				});
			})
			.filter(([key, oldDevice]) => {
				//Здесь остались только item
				if (!oldDevice.Key.startsWith("LogicType")) return true;

                const reagentItems:ReagentItem[] = [];
                
				logics.data.push({
					key: key,
					name: oldDevice.Title,
					description: oldDevice.Description
				});
			});
		devices.data.sort((a, b) => a.Key.localeCompare(b.Key));
		items.data.sort((a, b) => a.Key.localeCompare(b.Key));
		GODPromise.push(writeFile("devices.json", `./dist/${languages}`, devices));
		GODPromise.push(writeFile("items.json", `./dist/${languages}`, items));
		GODPromise.push(writeFile("reagents.json", `./dist/${languages}`, reagents));
		GODPromise.push(writeFile("logics.json", `./dist/${languages}`, logics));
	}
}

await step0()
await step1()
await step2()
await step3()
await optimizeData();

await Promise.all(GODPromise);
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
