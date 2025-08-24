import {
  mkdir
} from "node:fs/promises";
import { cpus } from "node:os";

export function strip(
  obj: Record<string, Record<string, any>>
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

export function urlJoin(...parts: (string | undefined | null)[]): string {
  return parts
    .map((part, i) => {
      if (!part) return ''; // если часть пустая, возвращаем пустую строку
      if (i === 0) return part.replace(/\/+$/, '');
      return part.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

const TAGS_REGEX = /<[^>]*>?/gm;

// ---------------------------------------------- UTILS ----------------------------------------------
export const stripTags = (s: string) => s.replace(TAGS_REGEX, "");
export const ensureDir = (dir: string) => mkdir(dir, { recursive: true });

export function cpuWorkers(): number {
  // Используем все, кроме одного ядра. Минимум 1 поток.
  return Math.max(1, cpus().length - 1);
}
