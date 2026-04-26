import { ZVENT_TAG_REGEX } from "../../constants";

export function parseZventId(tag: string): string | null {
	return tag.match(ZVENT_TAG_REGEX)?.[1] ?? null;
}
