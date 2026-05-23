import type { z } from "zod";
import { defineConfig } from "../kernel";
import type { ConfigDefinition } from "../types";
import { readTripConfig, readTripConfigVersion, writeTripConfig } from "./io";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { tripV1ToV2 } from "./migrations/v1_to_v2";
import { tripV0Schema } from "./schemas/v0";
import { tripV1Schema } from "./schemas/v1";
import type { TripV2 } from "./schemas/v2";
import { tripV2Schema } from "./schemas/v2";

type TripSchemas = {
	0: z.ZodTypeAny;
	1: z.ZodTypeAny;
	2: z.ZodType<TripV2>;
};

export const tripConfig: ConfigDefinition<"trip", TripSchemas, 2> =
	defineConfig({
		name: "trip",
		latestVersion: 2,
		schemas: {
			0: { schema: tripV0Schema, migrations: { 1: tripV0ToV1 } },
			1: { schema: tripV1Schema, migrations: { 2: tripV1ToV2 } },
			2: { schema: tripV2Schema },
		},
		readConfig: readTripConfig,
		writeConfig: writeTripConfig,
		parseVersion: readTripConfigVersion,
	} as ConfigDefinition<"trip", TripSchemas, 2>);
