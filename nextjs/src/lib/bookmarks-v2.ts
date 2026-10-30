/**
 * Bookmarks v2 — Local-only bookmark system (localStorage)
 */

import type { AppLanguage } from "./types";

export interface BookmarkV2 {
  id?: string;
  law_key: string;
  law_title: string;
  category: string;
  norm_id?: string;
  norm_title?: string;
  snippet?: string;
  added_at: string;
  folder_id?: string | null;
  synced: boolean;
}

export interface BookmarkFolder {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  incident_date: string | null;
  dispute_value: number;
  status: "pre_action" | "consulting" | "filed" | "in_progress" | "resolved";
  opposing_party: string;
  deadline_date: string | null;
  court_name: string;
  case_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  category?: string;
  incident_date?: string;
  dispute_value?: number;
  status?: BookmarkFolder["status"];
  opposing_party?: string;
  deadline_date?: string;
  court_name?: string;
  case_number?: string;
  notes?: string;
}

export type UpdateFolderInput = Partial<CreateFolderInput>;

const BOOKMARKS_KEY = "glv_bookmarks_v2";
const FOLDERS_KEY = "glv_folders";

function getLocalBookmarks(): BookmarkV2[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalBookmarks(bookmarks: BookmarkV2[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

function getLocalFolders(): BookmarkFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalFolders(folders: BookmarkFolder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function getBookmarks(): BookmarkV2[] {
  return getLocalBookmarks();
}

export async function addBookmark(
  b: Omit<BookmarkV2, "synced">,
): Promise<void> {
  const bookmarks = getLocalBookmarks();
  const exists = bookmarks.some(
    (x) => x.law_key === b.law_key && (x.norm_id || "") === (b.norm_id || ""),
  );
  if (exists) return;

  const newBm: BookmarkV2 = { ...b, synced: false };
  bookmarks.unshift(newBm);
  setLocalBookmarks(bookmarks);
}

export async function removeBookmark(
  lawKey: string,
  normId?: string,
): Promise<void> {
  let bookmarks = getLocalBookmarks();
  bookmarks = bookmarks.filter(
    (b) => !(b.law_key === lawKey && (b.norm_id || "") === (normId || "")),
  );
  setLocalBookmarks(bookmarks);
}

export function isBookmarked(lawKey: string, normId?: string): boolean {
  return getLocalBookmarks().some(
    (b) => b.law_key === lawKey && (b.norm_id || "") === (normId || ""),
  );
}

export function getFolders(): BookmarkFolder[] {
  return getLocalFolders();
}

export async function createFolder(
  input: CreateFolderInput,
): Promise<BookmarkFolder> {
  const folder: BookmarkFolder = {
    id: crypto.randomUUID(),
    user_id: "",
    name: input.name,
    description: input.description || "",
    category: input.category || "other",
    incident_date: input.incident_date || null,
    dispute_value: input.dispute_value || 0,
    status: input.status || "pre_action",
    opposing_party: input.opposing_party || "",
    deadline_date: input.deadline_date || null,
    court_name: input.court_name || "",
    case_number: input.case_number || "",
    notes: input.notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const folders = getLocalFolders();
  folders.push(folder);
  setLocalFolders(folders);

  return folder;
}

export async function updateFolder(
  id: string,
  input: UpdateFolderInput,
): Promise<BookmarkFolder | null> {
  const folders = getLocalFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx < 0) return null;

  folders[idx] = {
    ...folders[idx],
    ...input,
    updated_at: new Date().toISOString(),
  };
  setLocalFolders(folders);

  return folders[idx];
}

export async function deleteFolder(id: string): Promise<void> {
  const folders = getLocalFolders().filter((f) => f.id !== id);
  setLocalFolders(folders);
}

export function migrateFromV1(): void {
  if (typeof window === "undefined") return;
  try {
    const v2exists = localStorage.getItem(BOOKMARKS_KEY);
    if (v2exists) return;

    const raw = localStorage.getItem("glv_bookmarks");
    if (!raw) return;

    const v1bookmarks: {
      law_key: string;
      law_title: string;
      category: string;
      norm_id?: string;
      norm_title?: string;
      snippet?: string;
      added_at: string;
    }[] = JSON.parse(raw);
    if (!Array.isArray(v1bookmarks) || v1bookmarks.length === 0) return;

    const v2bookmarks: BookmarkV2[] = v1bookmarks.map((b) => ({
      law_key: b.law_key,
      law_title: b.law_title || b.law_key,
      category: b.category || "other",
      norm_id: b.norm_id,
      norm_title: b.norm_title,
      snippet: b.snippet,
      added_at: b.added_at || new Date().toISOString(),
      folder_id: undefined,
      synced: false,
    }));

    const existing = getLocalBookmarks();
    const merged = [...v2bookmarks];
    for (const eb of existing) {
      const dup = merged.some(
        (m) =>
          m.law_key === eb.law_key && (m.norm_id || "") === (eb.norm_id || ""),
      );
      if (!dup) merged.push(eb);
    }

    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(merged));
    localStorage.removeItem("glv_bookmarks");
  } catch {
    // Silent
  }
}

export async function syncBookmarksLocal(): Promise<void> {
  // No-op in local edition
}
