// Copied from makonbook-mobile/src/lib/vocab/types.ts (docs/handoff.md section 5).

// Vocabulary (the API's spec 11). The contract is the API's api/openapi.yaml
// (VocabList, VocabReview); keep in step.

export type VocabImage = { file: string; bytes: number; width: number; height: number };

export type VocabWord = {
  id: string;
  word: string;
  part_of_speech: string | null;
  definition: string;
  example: string;
  image: VocabImage | null;
};

export type VocabList = { slug: string; title: string; words: VocabWord[] };

export type Deck = { version: string; lists: VocabList[] };

/** One review in the log: the rating, and the card's FSRS state after it. */
export type Review = {
  id: string;
  word_id: string;
  rating: 1 | 2 | 3 | 4;
  reviewed_at: string;
  duration_ms: number;
  state: 0 | 1 | 2 | 3;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
};

export type GroupVocabStudent = {
  client_id: number;
  first_name: string;
  last_name: string;
  started: number;
  learned: number;
  reviews_week: number;
  last_review: string | null;
};
