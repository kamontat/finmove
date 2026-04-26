import {
	createContext,
	type JSX,
	type ReactNode,
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
	return {
		values,
		setField: (key, value) => store.setField(formId, key, value),
		setValues: (v) => store.setValues(formId, v),
		clear: () => store.clear(formId),
	};
}

interface UseFormBufferAdminResult {
	clearByPrefix: (prefix: string) => void;
}

export function useFormBufferAdmin(): UseFormBufferAdminResult {
	const store = useStore();
	return {
		clearByPrefix: (prefix) => store.clearByPrefix(prefix),
	};
}
