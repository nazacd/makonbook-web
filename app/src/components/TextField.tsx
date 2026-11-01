import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';

import { Icon } from './Icon';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'id'> & {
  label: string;
  /** Shown under the field, in place of the hint. */
  error?: string | null;
  hint?: string;
  /** A password field, with a Show/Hide control. */
  secure?: boolean;
  /** Shown before the text, inside the field (e.g. "@" for a username). */
  prefix?: string;
  ref?: Ref<HTMLInputElement>;
};

// Label above, the field on the surface step with a hairline that turns
// accent on focus and bad on error; the error or hint under it. Errors sit
// next to the field they are about.
export function TextField({ label, error, hint, secure = false, prefix, ref, ...props }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const border = error ? 'border-bad' : 'border-line-strong focus-within:border-accent';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="t-footnote text-ink-2">
        {label}
      </label>
      <div className={`flex h-[52px] items-center overflow-hidden rounded-control border-[1.5px] bg-surface ${border}`}>
        {prefix && <span className="t-body pl-4 text-ink-3">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          type={secure && !revealed ? 'password' : 'text'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          className={`t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3 ${prefix ? 'pl-0.5 pr-4' : 'px-4'}`}
          {...props}
        />
        {secure && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="flex h-full w-14 items-center justify-center text-ink-2 active:text-ink"
            aria-label={revealed ? 'Hide password' : 'Show password'}>
            {/* The icon shows what a click does: an open eye reveals, a struck eye hides again. */}
            <Icon as={revealed ? EyeOff : Eye} size={22} className="text-current" />
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={`${id}-note`} className={`t-footnote ${error ? 'text-bad' : 'text-ink-3'}`} aria-live={error ? 'polite' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
