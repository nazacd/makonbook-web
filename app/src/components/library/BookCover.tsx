import type { Book } from '@/api/library';

// A book standing on the shelf: its cover tilted a little, with a lit spine
// and a block of pages down its side (`.book` in styles.css). Books without
// a cover get their title on a plain binding.

export function BookCover({ book, width, flat = false }: { book: Pick<Book, 'title' | 'subject' | 'cover_url'>; width: number; flat?: boolean }) {
  return (
    <span className={`book ${flat ? 'book-flat' : ''}`} style={{ width, height: (width * 4) / 3 }}>
      {book.cover_url ? (
        <img src={book.cover_url} alt="" draggable={false} loading="lazy" />
      ) : (
        <span className="flex size-full items-center justify-center p-3 text-center text-[13px] font-extrabold leading-4 text-white" style={{ background: book.subject === 'math' ? 'linear-gradient(160deg,#5a12bf,#2a0063)' : 'linear-gradient(160deg,#157a83,#0b3f45)' }}>
          {book.title}
        </span>
      )}
    </span>
  );
}
