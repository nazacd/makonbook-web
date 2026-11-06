import { startTelegram, useAppConfig } from '@/api/accounts';

// "Continue with Telegram", shown when the server has a bot set up.
export function TelegramButton() {
  const telegram = useAppConfig().data?.telegram;
  if (!telegram) return null;
  return (
    <button type="button" onClick={() => startTelegram(telegram.bot_id)} className="flex h-12 w-full items-center justify-center gap-3 rounded-card border border-line-strong bg-surface text-[15px] font-bold text-ink hover:bg-surface-2">
      <TelegramMark />
      Continue with Telegram
    </button>
  );
}

export function TelegramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path fill="#fff" d="M5.4 11.8l10.9-4.2c.5-.2 1 .1.8.9l-1.9 8.8c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.8-.9c-.6-.2-.6-.6.1-.9z" />
    </svg>
  );
}
