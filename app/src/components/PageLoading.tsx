import { Spinner } from './Button';

/** While a page's code arrives (pages load when first opened). */
export function PageLoading({ full = false }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'min-h-dvh' : 'py-24'}`} aria-label="Loading">
      <Spinner className="size-7 text-accent" />
    </div>
  );
}
