import { choose, getScene, inspectItem, moveCord } from "./engine.ts";
import { isStoredCordOrder } from "./cordPuzzle.ts";
import { createGame } from "./state.ts";
import { openingScenes } from "../story/opening.ts";
import { items } from "../story/items.ts";
import type { GameState, ItemId, SceneId } from "./types.ts";
import { condenseLegacy, diaryForChoice, diaryForItem, openingDiary } from "./diary.ts";
import type { DiaryEntry } from "./diary.ts";

interface LegacyHistoryEntry {
  scene: SceneId;
  day: number;
  time: GameState["time"];
  location: string;
  title: string;
  paragraphs: string[];
  choice?: { id: string; text: string };
  ending?: string;
}

export interface JourneyRecord {
  id: string;
  startedAt: string;
  updatedAt: string;
  entries: DiaryEntry[];
}

export interface CurrentJourney extends JourneyRecord { state: GameState }
export interface GameRecords {
  version: 2;
  current: CurrentJourney | null;
  archives: JourneyRecord[];
}

export const emptyRecords = (): GameRecords => ({ version: 2, current: null, archives: [] });

export function startJourney(records: GameRecords, now = new Date().toISOString()): GameRecords {
  const state = createGame();
  const archives = [...records.archives];
  if (records.current) {
    const { state: _state, ...archive } = records.current;
    archives.push(archive);
  }
  return {
    version: 2, archives,
    current: {
      id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
      startedAt: now, updatedAt: now, state, entries: [openingDiary(state)],
    },
  };
}

export function recordChoice(records: GameRecords, choiceId: string, now = new Date().toISOString()): GameRecords {
  const current = records.current;
  if (!current) return records;
  const choice = getScene(current.state).choices.find(candidate => candidate.id === choiceId);
  if (!choice) return records;
  const state = choose(current.state, choiceId);
  const diary = diaryForChoice(current.state, choice.id, state);
  const entries = diary && !current.entries.some(entry => entry.key === diary.key)
    ? [...current.entries, diary] : current.entries;
  return { ...records, current: { ...current, state, entries, updatedAt: now } };
}

export function recordItemInspection(records: GameRecords, item: ItemId): GameRecords {
  if (!records.current) return records;
  const state = inspectItem(records.current.state, item);
  if (state === records.current.state) return records;
  const diary = diaryForItem(records.current.state, state);
  const entries = diary && !records.current.entries.some(entry => entry.key === diary.key)
    ? [...records.current.entries, diary] : records.current.entries;
  return { ...records, current: { ...records.current, state, entries, updatedAt: new Date().toISOString() } };
}

export function recordCordMove(records: GameRecords, from: number, to: number, now = new Date().toISOString()): GameRecords {
  if (!records.current) return records;
  const state = moveCord(records.current.state, from, to);
  if (state === records.current.state) return records;
  return { ...records, current: { ...records.current, state, updatedAt: now } };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isDay = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
const isTime = (value: unknown) => value === "night" || value === "morning";
const isScene = (value: unknown): value is SceneId => typeof value === "string" && Object.prototype.hasOwnProperty.call(openingScenes, value);
const isDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

function isState(value: unknown): value is GameState {
  if (!isObject(value) || !isScene(value.scene) || !isDay(value.day) || !isTime(value.time)) return false;
  if (!Number.isInteger(value.forestSteps) || (value.forestSteps as number) < 0 || (value.forestSteps as number) > 13) return false;
  if (!Number.isInteger(value.fusion) || (value.fusion as number) < 0 || (value.fusion as number) > 6) return false;
  if (!Array.isArray(value.inventory) || !value.inventory.every(item => typeof item === "string" && Object.prototype.hasOwnProperty.call(items, item)) || new Set(value.inventory).size !== value.inventory.length) return false;
  // 旧存档没有绳阵顺序或使用上一版的二十位排列；进入机关时会转换为环形绳阵。
  if (value.cordOrder !== undefined && !isStoredCordOrder(value.cordOrder)) return false;
  if (value.ringDroppedOnDay !== null && (!isDay(value.ringDroppedOnDay) || value.ringDroppedOnDay > value.day)) return false;
  if (!["unresolved", "eaten", "pretended", "declined"].includes(value.breakfast as string)) return false;
  const flags = value.flags;
  return isObject(flags) && Object.keys(createGame().flags).every(key => typeof flags[key] === "boolean");
}

function isLegacyEntry(value: unknown): value is LegacyHistoryEntry {
  if (!isObject(value) || !isScene(value.scene) || !isDay(value.day) || !isTime(value.time)) return false;
  if (typeof value.location !== "string" || typeof value.title !== "string" || !Array.isArray(value.paragraphs) || !value.paragraphs.every(text => typeof text === "string")) return false;
  if (value.ending !== undefined && typeof value.ending !== "string") return false;
  return value.choice === undefined || (isObject(value.choice) && typeof value.choice.id === "string" && typeof value.choice.text === "string");
}

function isDiaryEntry(value: unknown): value is DiaryEntry {
  return isObject(value) && typeof value.key === "string" && value.key.length > 0 && isDay(value.day)
    && isTime(value.time) && typeof value.title === "string" && typeof value.text === "string"
    && (value.ending === undefined || typeof value.ending === "string");
}

function isJourney(value: unknown, legacy: boolean): value is JourneyRecord {
  return isObject(value) && typeof value.id === "string" && isDate(value.startedAt) && isDate(value.updatedAt)
    && Array.isArray(value.entries) && value.entries.length > 0
    && value.entries.every(legacy ? isLegacyEntry : isDiaryEntry)
    && (legacy || new Set(value.entries.map(entry => entry.key)).size === value.entries.length);
}

export function parseRecords(raw: string): GameRecords | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObject(data) || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.archives)) return null;
    const legacy = data.version === 1;
    if (!data.archives.every(archive => isJourney(archive, legacy))) return null;
    if (data.current !== null) {
      const current = data.current;
      if (!isJourney(current, legacy) || !isObject(current) || !isState(current.state)) return null;
      if (legacy) {
        const last = current.entries[current.entries.length - 1] as unknown as LegacyHistoryEntry;
        if (last.scene !== (current.state as GameState).scene || last.day !== (current.state as GameState).day || last.time !== (current.state as GameState).time || last.choice !== undefined) return null;
      }
    }
    if (!legacy) return data as unknown as GameRecords;
    const convert = (journey: Record<string, unknown>): JourneyRecord => ({
      id: journey.id as string, startedAt: journey.startedAt as string, updatedAt: journey.updatedAt as string,
      entries: condenseLegacy(journey.entries as LegacyHistoryEntry[]),
    });
    const current = data.current as Record<string, unknown> | null;
    return {
      version: 2,
      archives: (data.archives as unknown as Record<string, unknown>[]).map(convert),
      current: current ? { ...convert(current), state: current.state as GameState } : null,
    };
  } catch { return null; }
}

export const SAVE_KEY = "snow-inn.records.v1";
type StoragePort = Pick<Storage, "getItem" | "setItem">;

// 损坏/未来版本记录保留原样；其他窗口写入时也不覆盖它的进度。
export function openRecordStore(getStorage: () => StoragePort) {
  let original: string | null = null;
  let blocked = false;
  let message = "";
  let data = emptyRecords();
  try {
    original = getStorage().getItem(SAVE_KEY);
    if (original !== null) {
      const parsed = parseRecords(original);
      if (parsed) data = parsed;
      else {
        blocked = true;
        message = "本机记录暂时无法读取，原数据已保留。当前游玩不会覆盖它，也暂时无法保存。";
      }
    }
  } catch {
    message = "当前无法读取本机记录。可以游玩，但进度可能无法保存。";
  }
  return {
    data,
    get message() { return message; },
    save(records: GameRecords): boolean {
      if (blocked) return false;
      try {
        const storage = getStorage();
        if (storage.getItem(SAVE_KEY) !== original) {
          message = "另一个窗口更新了记录，本窗口的新进度暂未保存。请勿关闭本窗口，以免丢失这段进度。";
          return false;
        }
        const raw = JSON.stringify(records);
        storage.setItem(SAVE_KEY, raw);
        original = raw;
        message = "";
        return true;
      } catch {
        message = "本次进度暂未保存，请勿关闭或刷新窗口。下一次选择时会再次尝试保存。";
        return false;
      }
    },
  };
}
