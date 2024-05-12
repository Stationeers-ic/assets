import type {OldDevice} from "./tools/types";

console.info("Start building...");
import Bun, {$} from "bun";
import {mkdir, rename, rmdir, copyFile as copy, writeFile as write} from "node:fs/promises";
import {basename, join} from "path";
import * as fs from "node:fs";

const GODPromise: Promise<any>[] = []

async function step0() {
    console.time("Clear DIST");
    await rmdir("./dist", {recursive: true});
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
        const firstLetter = name[0];
        const secondLetter = name[1];
        const dir = join(__dirname, "dist", "images", firstLetter, secondLetter);
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
    type OldDevices = Record<string, OldDevice>
    type Device = {
        id: number,
        Key: string,
        PrefabName: string,
        PrefabHash: number,
        hasChip: boolean,
        deviceConnectCount: number,
        image: string,
        mods: string[],
        connections: string[],
        slots: {
            SlotName: string,
            SlotType: string,
            SlotIndex: number,
            logic: string[]
        }[],
        tags: string[],
        logics: {
            name: string,
            permissions: string[]
        }[]
    }
    type Devices = {
        data: Device[]
        images:Record<`SlotType.${string}`, string>
    }
    const languages = new Bun.Glob("**/data.json");
    for await (const file of languages.scan("./dist")) {
        console.log(file);
        const [languages, name] = file.split("/");
        if (languages.length !== 2) continue;
        if (name !== "data.json") continue;
        const data = require(join(__dirname, "dist", file)) as OldDevices;
        //OldDevice to Device TODO images
        const devices: Devices = {data: [], images: {}}
        for (const key in data) {
            const oldDevice = data[key];
            if (!oldDevice.PrefabName) continue
            if (!oldDevice.MainImage) continue
            if (!oldDevice.tags.includes("hasLogic")) continue;
            let hasChip = false;
            if (oldDevice.tags.includes("hasChip")) hasChip = true;
            const logics: {
                name: string,
                permissions: string[]
            }[] = []
            for (const logic of oldDevice.LogicInsert) {
                const logicName = logic.LogicName.replace(/<[^>]*>?/gm, '');
                const permissions = logic.LogicAccessTypes.split(" ");
                logics.push({
                    name: logicName,
                    permissions: permissions
                })
            }
            const slots: {
                SlotName: string,
                SlotType: string,
                SlotIndex: number,
                logic: string[]
            }[] = []
            const slotLogic: Record<number, string[]> = {}
            oldDevice.LogicSlotInsert.forEach((sl) => {
                const logicName = sl.LogicName.replace(/<[^>]*>?/gm, '');
                const slotIndexs = sl.LogicAccessTypes.split(", ").map((index) => Number(index));
                slotIndexs.forEach((index) => {
                    if (!slotLogic[index]) slotLogic[index] = []
                    slotLogic[index].push(logicName)
                });
            })

            oldDevice.SlotInserts.forEach((slot) => {
                const slotName = slot.SlotName;
                const slotType = slot.SlotType;
                const slotIndex = Number(slot.SlotIndex);
                // const logic = slot.LogicInsert.map((logic) => logic.LogicName);
                slots.push({
                    SlotName: slotName,
                    SlotType: slotType,
                    SlotIndex: slotIndex,
                    logic: slotLogic[slotIndex] ?? []
                })
            })

            const device: Device = {
                id: oldDevice.PrefabHash,
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
                logics: logics
            }
            devices.data.push(device);
        }
        GODPromise.push(writeFile("devices.json", `./dist/${languages}`, devices));
    }
}

// await step0()
// await step1()
// await step2()
// await step3()
await optimizeData()

await Promise.all(GODPromise);
//----------------------------------------------HELPERS----------------------------------------------
function findImage(fileName: string): string {
    if (!fileName) return "";
    if (fileName.includes("/") || fileName.includes("\\")) return fileName;
    const firstLetter = fileName[0];
    const secondLetter = fileName[1];
    return join("images", firstLetter, secondLetter, fileName);
}

async function writeFile(file: string, dir: string, content?: {}) {
    await mkdir(dir, {recursive: true});
    return write(join(dir, file), JSON.stringify(content), {
        encoding: "utf-8"
    });
}

async function moveFile(file: string, dir: string, newName?: string) {
    await mkdir(dir, {recursive: true});
    return rename(file, join(dir, newName ?? basename(file)));
}

async function copyFile(file: string, dir: string, newName?: string) {
    await mkdir(dir, {recursive: true});
    return copy(file, join(dir, newName ?? basename(file)));
}