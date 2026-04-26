import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useSyncExternalStore,
} from "react";
import {
	type FieldValue,
	FormBufferStore,
	type FormValues,
} from "./formBufferStore";

const FormBufferContext = createContext<FormBufferStore | null>(null);

const EMPTY: FormValues = Object.freeze({}) as FormValues;

interface FormBufferProviderProps {
	children: ReactNode;
}

export function FormBufferProvider({
	children,
}: FormBufferProviderProps): JSX.Element {
	const store = useMemo(() => new FormBufferStore(), []);
	return (
		<FormBufferContext.Provider value={store}>
			{children}
		</FormBufferContext.Provider>
	);
}

function useStore(): FormBufferStore {
	const store = useContext(FormBufferContext);
	if (!store) {
		throw new Error("FormBufferProvider missing");
	}
	return store;
}

interface UseFormBufferResult {
	values: FormValues;
	setField: (key: string, value: FieldValue) => void;
	setValues: (values: FormValues) => void;
	clear: () => void;
}

export function useFormBuffer(formId: string): UseFormBufferResult {
	const store = useStore();
	const values = useSyncExternalStore(
		(fn) => store.subscribe(fn),
		() => store.get(formId) ?? EMPTY,
		() => store.get(formId) ?? EMPTY,
	);
	const setField = useCallback(
		(key: string, value: FieldValue) => store.setField(formId, key, value),
		[store, formId],
	);
	const setValues = useCallback(
		(v: FormValues) => store.setValues(formId, v),
		[store, formId],
	);
	const clear = useCallback(() => store.clear(formId), [store, formId]);
	return { values, setField, setValues, clear };
}

interface UseFormBufferAdminResult {
	clearByPrefix: (prefix: string) => void;
}

export function useFormBufferAdmin(): UseFormBufferAdminResult {
	const store = useStore();
	const clearByPrefix = useCallback(
		(prefix: string) => store.clearByPrefix(prefix),
		[store],
	);
	return { clearByPrefix };
}
