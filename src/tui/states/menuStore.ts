import type { FocusZone } from "../models";

export interface MenuOptionMainAction {
  confirmCount?: number;
  check?: (index: number) => boolean;
  onConfirm: (index: number) => void;
}

export interface MenuOption {
  label: string;
  value: string;
  key?: string;
  mainAction?: MenuOptionMainAction;
}

export interface ArmedState {
  value: string;
  index: number;
  count: number;
}

export class MenuStore {
  private options: MenuOption[] = [];
  private onSelect: ((value: string) => void) | null = null;
  private activeIndex: number | null = null;
  private armed: ArmedState | null = null;

  getOptions(): MenuOption[] {
    return this.options;
  }

  getOnSelect(): ((value: string) => void) | null {
    return this.onSelect;
  }

  getArmed(): ArmedState | null {
    return this.armed;
  }

  getActiveIndex(): number | null {
    return this.activeIndex;
  }

  getArmedHint(): string | null {
    return null;
  }

  setMenu(options: MenuOption[], onSelect: (value: string) => void): void {
    this.options = options;
    this.onSelect = onSelect;
    this.activeIndex = null;
    this.armed = null;
  }

  setActiveIndex(index: number | null): void {
    this.activeIndex = index;
  }

  reset(): void {
    this.armed = null;
  }

  trigger(value: string, focus: FocusZone): void {
    const opt = this.options.find((o) => o.value === value);
    if (!opt) return;

    if (focus === "main" && opt.mainAction && this.activeIndex !== null) {
      // implemented in later tasks
      return;
    }

    this.armed = null;
    this.onSelect?.(value);
  }
}
