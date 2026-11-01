import { idbGet, idbSet } from '@/lib/idb';

import type { Deck, Review } from './types';

// In this browser: the deck (one for everyone), each person's review log,
// only ever appended to, both in IndexedDB; and the word images' links,
// which work for six hours, kept in memory and in localStorage.

const deckKey = 'vocab.deck';
const logKey = (person: string) => `vocab.log.${person}`;
const linksKey = 'mb.vocab.images';

type Links = { urls: Record<string, string>; expires_at: string };
let links: Links | null = null;

function loadLinks(): Links {
  if (links) return links;
  try {
    const raw = localStorage.getItem(linksKey);
    links = raw ? (JSON.parse(raw) as Links) : { urls: {}, expires_at: '' };
  } catch {
    links = { urls: {}, expires_at: '' };
  }
  return links;
}

export async function readDeck(): Promise<Deck | null> {
  return (await idbGet<Deck>(deckKey)) ?? null;
}

export async function writeDeck(deck: Deck): Promise<void> {
  await idbSet(deckKey, deck);
}

export async function readLog(person: string): Promise<Review[]> {
  return (await idbGet<Review[]>(logKey(person))) ?? [];
}

export async function appendLog(person: string, reviews: Review[]): Promise<void> {
  await idbSet(logKey(person), [...(await readLog(person)), ...reviews]);
}

/** Whether an image's link is here and still good. */
export function hasImage(file: string): boolean {
  const l = loadLinks();
  return !!l.urls[file] && Date.parse(l.expires_at) > Date.now() + 60_000;
}

export function storeImageLinks(fresh: Record<string, string>, expiresAt: string): void {
  const l = loadLinks();
  // One expiry for all: the earliest still unexpired batch wins when mixed.
  const expires = l.expires_at && Date.parse(l.expires_at) > Date.now() ? (l.expires_at < expiresAt ? l.expires_at : expiresAt) : expiresAt;
  links = { urls: { ...l.urls, ...fresh }, expires_at: expires };
  try {
    localStorage.setItem(linksKey, JSON.stringify(links));
  } catch {
    // Kept in memory for this page.
  }
}

export function imageUri(file: string): string {
  return loadLinks().urls[file] ?? '';
}
