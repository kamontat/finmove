import type { z } from "zod";

export type ConfigRaw = Record<string, unknown>;

export type ConfigSchemas<S extends Record<number, z.ZodTypeAny>> = {
	[V in keyof S]: {
		schema: S[V];
		migrations?: {
			[Target in Exclude<keyof S, V>]?: (
				current: z.infer<S[V]>,
			) => z.infer<S[Target]>;
		};
	};
};

export type ConfigDefinition<
	Name extends string,
	Schemas extends Record<number, z.ZodTypeAny>,
	LVersion extends keyof Schemas & number,
> = {
	name: Name;
	latestVersion: LVersion;
	schemas: ConfigSchemas<Schemas>;
	readConfig: (location: string) => ConfigRaw;
	writeConfig: (location: string, data: ConfigRaw) => void;
	parseVersion: (raw: ConfigRaw) => number;
};

export type ConfigResult<
	Schemas extends Record<number, z.ZodTypeAny>,
	L extends keyof Schemas,
> = {
	data: z.infer<Schemas[L]>;
	migrated: boolean;
	fromVersion: number;
	toVersion: L;
};
