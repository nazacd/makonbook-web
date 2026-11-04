// Copied from makonbook-mobile/src/lib/practice/types.ts (docs/handoff.md section 5).
// The contract is the API's PracticePackage etc.; keep in step with the phone.

// Practice tests (spec 9.5). The contract is the API's api/openapi.yaml
// (PracticeCatalogTest, PracticePackage, PracticeAttempt); keep in step.

export type Subject = 'english' | 'math';

export type CatalogTest = {
  code: string;
  title: string;
  english: number;
  math: number;
  questions: number;
  approved: number;
  /** The latest published version; null while the test is locked. */
  version: number | null;
  /** Locked because it is for SATMAKON students and this account isn't one (yet). */
  enrolled_only?: boolean;
  /** The download's size in bytes (package and images). */
  bytes: number | null;
  published_at: string | null;
};

export type Figure = { key: string; kind: string; alt: string };

export type PackageQuestion = {
  id: string;
  version: number;
  position: number;
  type: 'mcq' | 'grid_in';
  passage: string | null;
  stem: string;
  choices: Record<string, string> | null;
  figures: Figure[];
  correct: string | null;
  accepted: string[] | null;
  explanation: string;
  domain: string;
  skill: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
};

export type PackageModule = { module: 1 | 2; minutes: number; questions: PackageQuestion[] };

export type PackageSection = { subject: Subject; modules: PackageModule[]; scale: number[] };

export type PackageImage = { file: string; bytes: number; width: number; height: number };

export type Package = {
  format: 1;
  code: string;
  title: string;
  version: number;
  published_at: string;
  sections: PackageSection[];
  /** An image's key, as the text uses it (`![alt](r2:key)`) → its file. */
  images: Record<string, PackageImage>;
};

export type Score = { raw: number; questions: number; score: number };

/** An attempt as the server stored and graded it. */
export type ServerAttempt = {
  id: string;
  test: string;
  title: string;
  version: number;
  sections: Subject[];
  started_at: string;
  finished_at: string;
  scores: Partial<Record<Subject, Score>>;
  total: number | null;
};

/** One of the student's own attempts, from GET /v1/me/practice/attempts. */
export type OwnAttempt = ServerAttempt & { answers: AnswerInput[] };

export type AnswerInput = {
  subject: Subject;
  module: number;
  position: number;
  answer: string | null;
  seconds: number;
};

export type GroupStudent = {
  client_id: number;
  first_name: string;
  last_name: string;
  attempts: ServerAttempt[];
};
