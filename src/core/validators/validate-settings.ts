import type { Settings } from "../models";

export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];

  if (!settings.name || settings.name.trim() === "") {
    errors.push("Settings name must not be empty.");
  }

  if (!settings.startDate) {
    errors.push("Settings startDate is required.");
  }

  if (!settings.endDate) {
    errors.push("Settings endDate is required.");
  }

  if (settings.startDate && settings.endDate) {
    const start = new Date(settings.startDate);
    const end = new Date(settings.endDate);
    if (start > end) {
      errors.push(
        `Settings startDate (${settings.startDate}) must not be after endDate (${settings.endDate}).`,
      );
    }
  }

  if (!settings.countries || settings.countries.length === 0) {
    errors.push("Settings must have at least one country.");
  }

  if (!settings.baseCurrency) {
    errors.push("Settings baseCurrency is required.");
  }

  return errors;
}
