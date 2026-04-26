export const ZVENT_TAG_PREFIX = "Zvent" as const;

export const ZVENT_ID_PATTERN: RegExp = /^\d{3}$/;

export const ZVENT_DEFAULT_ID = "001";

export const ZVENT_TAG_REGEX: RegExp = /^Zvent: (\d{3}) /;

export const ZVENT_MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;
