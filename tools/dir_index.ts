import Bun, { write } from "bun";
import ejs from "ejs";
import type { Stats } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "path";

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
		const f:fileObject = {
			name: join(dir, file),
            type:"dir", // "dir" | "html" | "json" | "png
			stat: await stat(join(cwd, dir, file)),
		};
		if (f.stat.isDirectory()) {
            f.type = "dir";
			dirs.push(f);
		} else {
            f.type = getFileType(f.name);
			files.push(f);
		}
	}
	dirs.sort((a, b) => a.name.localeCompare(b.name));

	files.sort((a, b) => a.name.localeCompare(b.name));
	const html = await compile({
		title: `Directory Index "${dir}"`,
		description: "This is a directory index",
		back: dir ? dirname(dir) : "",
		files,
		dirs,
	});
	write(join(cwd, dir, "index.html"), html);
}

import * as fs from 'fs/promises';
import * as path from 'path';

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
