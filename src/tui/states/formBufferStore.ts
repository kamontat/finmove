export type FieldValue = string | string[] | boolean | number;
export type FormValues = Record<string, FieldValue>;

export class FormBufferStore {
	private buffers = new Map<string, FormValues>();
	private listeners = new Set<() => void>();

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	get(formId: string): FormValues | undefined {
		return this.buffers.get(formId);
	}

	setField(formId: string, key: string, value: FieldValue): void {
		const existing = this.buffers.get(formId) ?? {};
		this.buffers.set(formId, { ...existing, [key]: value });
		this.emit();
	}

	setValues(formId: string, values: FormValues): void {
		this.buffers.set(formId, { ...values });
		this.emit();
	}

	clear(formId: string): void {
		this.buffers.delete(formId);
		this.emit();
	}

	clearByPrefix(prefix: string): void {
		for (const id of [...this.buffers.keys()]) {
			if (id.startsWith(prefix)) {
				this.buffers.delete(id);
			}
		}
		this.emit();
	}

	private emit(): void {
		for (const fn of this.listeners) {
			try {
				fn();
			} catch (error) {
				console.error("FormBufferStore listener error:", error);
			}
		}
	}
}
