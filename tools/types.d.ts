// To parse this data:
//
//   import { Convert } from "./file";
//
//   const temperatures = Convert.toTemperatures(json);

export type OldDevice = {
	TYPE: string
	prefab: null | string
	Lang: string
	Key: string
	Title: null | string
	Description: string
	SortPriority: number
	ImportantPage: boolean
	Text: string
	ConstructWithText: null
	PrefabName: null | string
	PrefabHash: number
	PrefabHashString: null | string
	PaintableText: null | string
	StackSizeText: null | string
	ReagentsHash: number
	ReagentsType: null | string
	UnitText: null | string
	ReagentsText: null | string
	SpecificHeatText: null | string
	MaxLiquidTemperatureText: null | string
	FreezeTemperatureText: null | string
	BoilingTemperatureText: null | string
	MinLiquidPressure: null | string
	LatentHeatText: null | string
	MolesPerLitreText: null | string
	FlashpointText: null | string
	AutoIgnitionText: null | string
	ConvectionFactorText: null | string
	RadiationFactorText: null | string
	BasePowerDraw: null | string
	MaxPressure: null | string
	Volume: null | string
	Nutrition: null | string
	GrowthTime: null | string
	PlaceableInRocket: null | string
	RocketMass: null | string
	RocketEngineForce: null | string
	RocketEngineEfficiency: null | string
	RocketEngineExhaustVelocity: null | string
	PressureBreakText: null | string
	CableBreakText: null | string
	InternalAtmosInfoText: null
	DrillHeadProperties: DrillHeadProperties | null
	GasType: number
	DisplayFilter: number
	CustomSpriteToUse: null | string
	PageCustomCategories: string[]
	SlotInserts: SlotInsert[]
	HowToBuild: BuildState[]
	BuildStates: BuildState[]
	StructVersionInsert: StructVersionInsert[]
	LogicInsert: Insert[]
	LogicSlotInsert: Insert[]
	LogicInstructions: LogicInstruction[]
	ModeInsert: Insert[]
	ConnectionInsert: Insert[]
	FoundInOre: FoundInOre[]
	FoundInGas: FoundInGas[]
	ConstructedThings: ConstructedByKit[]
	ProducedThingsInserts: ConstructedByKit[]
	ConstructedByKits: ConstructedByKit[]
	ResourcesUsed: ConstructedByKit[]
	UsedIn: ConstructedByKit[]
	LifeRequirements: LifeRequirement[]
	DeviceConnectCount: number
	MainImage: null | string
	tags: string[]
	ID: string
}
export type NewDevices = {
	TYPE: string
	prefab?: string
	Lang: string
	Key: string
	Title?: string
	Description?: string
	SortPriority?: number
	ImportantPage?: boolean
	Text?: string
	ConstructWithText?: null
	PrefabName?: string
	PrefabHash?: number
	PrefabHashString?: string
	PaintableText?: string
	StackSizeText?: string
	ReagentsHash?: number
	ReagentsType?: string
	UnitText?: string
	ReagentsText?: null
	SpecificHeatText?: string
	MaxLiquidTemperatureText?: string
	FreezeTemperatureText?: string
	BoilingTemperatureText?: string
	MinLiquidPressure?: string
	LatentHeatText?: string
	MolesPerLitreText?: string
	FlashpointText?: string
	AutoIgnitionText?: string
	ConvectionFactorText?: string
	RadiationFactorText?: string
	BasePowerDraw?: string
	MaxPressure?: string
	Volume?: string
	Nutrition?: string
	GrowthTime?: string
	PlaceableInRocket?: string
	RocketMass?: string
	RocketEngineForce?: string
	RocketEngineEfficiency?: string
	RocketEngineExhaustVelocity?: string
	PressureBreakText?: string
	CableBreakText?: string
	InternalAtmosInfoText?: null
	DrillHeadProperties?: DrillHeadProperties | null
	GasType?: number
	DisplayFilter?: number
	CustomSpriteToUse?: string
	PageCustomCategories?: string[]
	SlotInserts?: SlotInsert[]
	HowToBuild?: BuildState[]
	BuildStates?: BuildState[]
	StructVersionInsert?: StructVersionInsert[]
	LogicInsert?: Insert[]
	LogicSlotInsert?: Insert[]
	LogicInstructions?: LogicInstruction[]
	ModeInsert?: Insert[]
	ConnectionInsert?: Insert[]
	FoundInOre?: FoundInOre[]
	FoundInGas?: FoundInGas[]
	ConstructedThings?: ConstructedByKit[]
	ProducedThingsInserts?: ConstructedByKit[]
	ConstructedByKits?: ConstructedByKit[]
	ResourcesUsed?: ConstructedByKit[]
	UsedIn?: ConstructedByKit[]
	LifeRequirements?: LifeRequirement[]
	DeviceConnectCount?: number
	MainImage?: string
	tags?: string[]
	ID: string
}
export type BuildState = {
	PrinterName: string
	TierName: null | string
	Details: null | string
	Description: string
	PageLink: null | string
	image: null | string
}

export type Insert = {
	LogicName: string
	LogicAccessTypes: string
}

export type ConstructedByKit = {
	NameOfThing: string
	PrefabHash: number
	PageLink: string
	image: null | string
}

export type DrillHeadProperties = {
	SpeedMultiplier: string
	ReagentYieldMultiplier: string
	IceYieldMultiplier: string
	HealthMultiplier: string
	PowerConsumptionMultiplier: string
}

export type FoundInGas = {
	NameOfThing: string
	QuantityOfThing: string
}

export type FoundInOre = {
	NameOfThing: string
	QuantityOfThing: number | string
}

export type LifeRequirement = {
	Name: string
	Value: string
	Gene: string
	ValueSize: number
}

export type LogicInstruction = {
	Text: string
	Index: number
	Info: string
}

export type SlotInsert = {
	SlotName: string
	SlotType: string
	SlotIndex: string
	image: null | string
}

export type StructVersionInsert = {
	StructureVersion: string
	CreationMultiplier: string
	EnergyCostMultiplier: string
	MaterialCostMultiplier: string
	BuildTimeMultiplier: string
	image: null
}

export type OldDevices = Record<string, OldDevice>
export type Device = {
	id: number
	Title: string
	Key: string
	PrefabName: string
	PrefabHash: number
	hasChip: boolean
	deviceConnectCount: number
	image: string
	mods: string[]
	connections: string[]
	slots: {
		SlotName: string
		SlotType: string
		SlotIndex: number
		logic: string[]
	}[]
	tags: string[]
	logics: {
		name: string
		permissions: string[]
	}[]
}

export type Item = {
	id: number
	Title: string
	Key: string
	PrefabName: string
	PrefabHash: number
	StackSize: number
	image: string
	tags: string[]
}

export type Devices = {
	data: Device[]
	images: Record<`SlotType.${string}`, string>
}
export type Items = {
	data: Item[]
}

// To parse this data:
//
//   import { Convert, Reagents } from "./file";
//
//   const reagents = Convert.toReagents(json);

export type Reagents = {
	data: Reagent[]
}

export type Reagent = {
	title: string
	name: string
	// hash:  number;
	image: string
	items: ReagentItem[]
}

export type ReagentItem = {
	title: string
	name: string
	hash: number
	image: string
	count: number
}
