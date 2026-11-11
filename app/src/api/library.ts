import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call } from './client';
import type { components } from './schema';

// The Library (makonbook-api docs/platform-spec.md §25): SAT MAKON's own
// books. Everyone signed in reads and downloads every book; each reader's
// page is remembered on the server, and a book's views are the people who
// have opened it.

type Schemas = components['schemas'];
export type Book = Schemas['LibraryBook'];

export const SUBJECT_LABEL: Record<Book['subject'], string> = { math: 'Math', english: 'Reading & Writing' };

const libraryKey = (person: string) => ['library', person] as const;

export function useLibrary(enabled = true) {
  const person = usePerson();
  return useQuery({ queryKey: libraryKey(person), enabled, queryFn: async () => (await call(api.GET('/v1/library'))).books });
}

/** A book's PDF, whole (the reader opens it; a download saves it). Kept for the visit. */
export function useBookFile(id: string, enabled = true) {
  return useQuery({
    queryKey: ['library-file', id],
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: () => call(api.GET('/v1/library/{id}/file', { params: { path: { id } }, parseAs: 'arrayBuffer' })) as unknown as Promise<ArrayBuffer>,
  });
}

/** Remembers the reader's page; the first time, the book gains a view. */
export function useSaveProgress(id: string) {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (page: number) => call(api.PUT('/v1/library/{id}/progress', { params: { path: { id } }, body: { page } })),
    onSuccess: (progress) =>
      queryClient.setQueryData<Book[]>(libraryKey(person), (books) => books?.map((b) => (b.id === id ? { ...b, progress, views: b.views + (b.progress ? 0 : 1) } : b))),
  });
}

/** Saves a book's PDF to the reader's device. */
export async function downloadBook(book: Pick<Book, 'id' | 'title'>, file?: ArrayBuffer): Promise<void> {
  const data = file ?? ((await call(api.GET('/v1/library/{id}/file', { params: { path: { id: book.id }, query: { download: '1' } }, parseAs: 'arrayBuffer' }))) as unknown as ArrayBuffer);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${book.title}.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "2.1 MB". */
export const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
