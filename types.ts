export type ReferenceType = "Constant" | "Enum";

export interface BaseEntry {
	referenceType: ReferenceType;
	literal: string;
	name: string;
	description?: string;
	// Поддерживаем и корректное "deprecated", и опечатку, чтобы тип принимал оба варианта.
	deprecated: boolean;
	// может отсутствовать, быть строкой или null (в некоторых записях prefix: null)
}

export interface ConstantEntry extends BaseEntry {
	referenceType: "Constant";
	// у констант значение может быть числом или строкой (NaN, Infinity и т.п.)
	value: number | string;
}

export interface EnumEntry extends BaseEntry {
	referenceType: "Enum";
	// у enum-значений в примере — числа
	value: number;
	prefix: string;
}

export type Entry = ConstantEntry | EnumEntry;

// Весь объект — отображение строковых ключей на записи
export type ConstantMap = Record<string, Entry>;
