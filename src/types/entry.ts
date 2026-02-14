export type Entry = {
  id: string;
  user_id: string;
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
