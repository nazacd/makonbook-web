export function GridInInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a number or fraction (e.g. 1/2)"
      aria-label="Your answer"
      autoComplete="off"
      spellCheck={false}
      maxLength={12}
      className="t-body h-[52px] w-full max-w-xs rounded-control border border-line bg-surface px-4 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
    />
  );
}
