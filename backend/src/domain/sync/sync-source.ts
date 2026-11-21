/** Fuentes externas de datos que se sincronizan (WhoScored y Football-Data). Una sola definición para todo el sistema. */
export const SYNC_SOURCES = ['whoscored', 'football_data'] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];
