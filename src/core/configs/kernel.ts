import type { z } from "zod";
import {
	ConfigMigrateError,
	ConfigNoMigrationPathError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "./errors";
import type { ConfigDefinition, ConfigResult } from "./types";

export function defineConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>): ConfigDefinition<N, S, L> {
	return def;
}

function chooseNextVersion(
	migrations: Record<number, unknown> | undefined,
	from: number,
	latest: number,
): number | null {
	if (!migrations) return null;
	const candidates = Object.keys(migrations)
		.map(Number)
		.filter((t) => t > from && t <= latest);
	if (candidates.length === 0) return null;
	return Math.max(...candidates);
}

export function loadConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>, location: string): ConfigResult<S, L> {
	const raw = def.readConfig(location);
	const initialV = def.parseVersion(raw);
	let v = initialV;

	if (v > def.latestVersion || !(v in def.schemas)) {
		throw new ConfigUnknownVersionError(
			def.name,
			location,
			v,
			def.latestVersion,
		);
	}

	let current: unknown = raw;
	while (true) {
		// biome-ignore lint/style/noNonNullAssertion: bounds checked above (v ∈ schemas) and after each migration step
		const entry = def.schemas[v]!;
		const parsed = entry.schema.safeParse(current);
		if (!parsed.success) {
			throw new ConfigValidateError(def.name, location, v, parsed.error.issues);
		}
		current = parsed.data;

		if (v === def.latestVersion) break;

		const next = chooseNextVersion(
			entry.migrations as Record<number, unknown> | undefined,
			v,
			def.latestVersion,
		);
		if (next === null) {
			throw new ConfigNoMigrationPathError(
				def.name,
				location,
				v,
				def.latestVersion,
			);
		}

		const migrateFn = (
			entry.migrations as Record<number, (x: unknown) => unknown>
		)[next];
		if (!migrateFn) {
			throw new ConfigNoMigrationPathError(
				def.name,
				location,
				v,
				def.latestVersion,
			);
		}
		try {
			current = migrateFn(current);
		} catch (cause) {
			throw new ConfigMigrateError(def.name, location, v, next, cause);
		}
		v = next;
	}

	const migrated = initialV < def.latestVersion;
	if (migrated) {
		saveConfig(def, location, current as z.infer<S[L]>);
	}

	return {
		data: current as z.infer<S[L]>,
		migrated,
		fromVersion: initialV,
		toVersion: def.latestVersion as L,
	};
}

export function saveConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>, location: string, data: z.infer<S[L]>): void {
	const valid = def.schemas[def.latestVersion].schema.parse(data) as Record<
		string,
		unknown
	>;
	def.writeConfig(location, valid);
}
