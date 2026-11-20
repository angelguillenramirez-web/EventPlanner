import { useSyncExternalStore } from "react";

/** The search text shared by the top bar and the My events list, so typing in either filters the events. */
let q = "";
const subs = new Set<() => void>();
export const setSearch = (v: string) => { q = v; subs.forEach((f) => f()); };
export const useSearch = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => q);
