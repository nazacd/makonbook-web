// "Are you sure?" in the browser (the phone's lib/confirm.web.ts).
export function confirm({ title, message, onConfirm }: { title: string; message: string; onConfirm: () => void }) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
