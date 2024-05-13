import Bun, { write } from "bun";
import ejs from "ejs";
import type { Stats } from "node:fs";
import fs, { readdir, stat } from "node:fs/promises";
import path, { dirname, join } from "path";

const templateString = await Bun.file(join(__dirname, "index.ejs")).text();

const template = ejs.compile(templateString, {
	async: true,
});

const compile = (data: {
	title: string;
	back: string;
	description: string;
	files: fileObject[];
	dirs: fileObject[];
}) => {
	return template(data);
};

type fileType = "dir" | "html" | "json" | "png";

export type fileObject = {
	name: string;
	type: fileType
	stat: Stats;
	size: string;
};


function getFileType(file: string):fileType {
	let type:fileType = "dir";
	if (file.endsWith("html")) type = "html";
	if (file.endsWith("json")) type = "json";
	if (file.endsWith("png")) type = "png";
	return type;
}

export async function dir_index(cwd: string, dir: string) {
	const iterator = await readdir(join(cwd, dir));
	const files: fileObject[] = [];
	const dirs: fileObject[] = [];

	for (const file of iterator) {
		if (file.endsWith("html")) continue;
        const fstat = await stat(join(cwd, dir, file))
        const name = join(dir, file)
		const f:fileObject = {
			name: name,
            type: fstat.isDirectory() ? "dir" : getFileType(name), // "dir" | "html" | "json" | "png
			stat: fstat,
			size: getValueAndUnit(fstat.size),
		};
		if (f.stat.isDirectory()) {
			dirs.push(f);
		} else {
			files.push(f);
		}
	}
	dirs.sort((a, b) => a.name.localeCompare(b.name));

	files.sort((a, b) => a.name.localeCompare(b.name));
	const html = await compile({
		title: `${dir}`,
		description: "This is a directory index",
		back: dir ? dirname(dir) : "",
		files,
		dirs,
	});
	write(join(cwd, dir, "index.html"), html);
}


export async function walkDir(dir: string, callback: (dirPath: string) => void): Promise<void> {
  const files = await fs.readdir(dir);
  for (let f of files) {
    let dirPath = path.join(dir, f);
    let isDirectory = (await fs.stat(dirPath)).isDirectory();
    if (isDirectory) {
      callback(dirPath);
      await walkDir(dirPath, callback);
    }
  }
};



const UNITS = ["byte", "KiB", "MiB", "GiB", "TiB", 'PiB'];

const getValueAndUnit = (n:number) => {
  const i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(2)} ${UNITS[i]}`;
};