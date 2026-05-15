import type { ZodIssue } from "zod";

export class ConfigError extends Error {
	constructor(
		public readonly namespace: string,
		public readonly location: string,
		message: string,
	) {
		super(`[${namespace} @ ${location}] ${message}`);
		this.name = "ConfigError";
	}
}

export class ConfigFileMissingError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly file: string,
	) {
		super(ns, loc, `Required file not found: ${file}`);
		this.name = "ConfigFileMissingError";
	}
}

export class ConfigParseError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly file: string,
		public override readonly cause: unknown,
	) {
		const reason = (cause as Error)?.message ?? String(cause);
		super(ns, loc, `Failed to parse ${file}: ${reason}`);
		this.name = "ConfigParseError";
	}
}

export class ConfigValidateError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly version: number,
		public readonly issues: ZodIssue[],
	) {
		const count = issues.length;
		super(
			ns,
			loc,
			`Schema validation failed at v${version} (${count} issue${count === 1 ? "" : "s"})`,
		);
		this.name = "ConfigValidateError";
	}
}

export class ConfigMigrateError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly from: number,
		public readonly to: number,
		public override readonly cause: unknown,
	) {
		const reason = (cause as Error)?.message ?? String(cause);
		super(ns, loc, `Migration v${from}→v${to} failed: ${reason}`);
		this.name = "ConfigMigrateError";
	}
}

export class ConfigUnknownVersionError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly version: number,
		public readonly latest: number,
	) {
		super(
			ns,
			loc,
			`Unknown version v${version} (latest supported: v${latest})`,
		);
		this.name = "ConfigUnknownVersionError";
	}
}

export class ConfigNoMigrationPathError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly from: number,
		public readonly latest: number,
	) {
		super(ns, loc, `No migration path from v${from} to v${latest}`);
		this.name = "ConfigNoMigrationPathError";
	}
}
