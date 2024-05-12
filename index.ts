console.info("Start building...");
import Bun, { $ } from "bun";
import { mkdir, rename, rmdir } from "node:fs/promises";
import { basename, join } from "path";

console.time("Clear DIST");
rmdir("./dist", { recursive: true });
console.timeEnd("Clear DIST");

//Оптимизация картинок
console.time("Optimize images");
await $`tools/oxipng -o max --strip safe --alpha ./images -r -q -t 8 --dir ./dist/images`;
console.timeEnd("Optimize images");
console.time("move images");
const distImages = new Bun.Glob("./dist/**/*.png");
for await (const file of distImages.scan(".")) {
	const name = basename(file);
	const firstLetter = name[0];
	const secondLetter = name[1];
	const dir = join(__dirname, "dist", "images", firstLetter, secondLetter);
	await mkdir(dir, { recursive: true });
	rename(file, join(dir, name));
}
console.timeEnd("move images");
