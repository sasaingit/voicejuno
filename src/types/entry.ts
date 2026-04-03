export type Entry = {
  id: string;
  account_id: string;
  created_by_user_id: string | null;
  title: string;
  transcript: string;
  recorded_at: string; // ISO
  created_at: string;
  updated_at: string;
};

export type EntryCreate = {
  title: string;
  transcript: string;
  recorded_at: string; // ISO
};

export type EntryPatch = {
  title?: string;
  transcript?: string;
};
