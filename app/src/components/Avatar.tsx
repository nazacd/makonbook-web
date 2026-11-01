// Students: one of twenty illustrated avatars, chosen by the first letter of
// their first name (A is 01 … T is 20, then U starts again at 01), the same
// pictures as the phone (public/avatars). Teachers: initials on a palette
// colour picked from their ID.
export function avatarIndex(firstName: string): number {
  const code = firstName.trim().toUpperCase().charCodeAt(0);
  return code >= 65 && code <= 90 ? (code - 65) % 20 : 0;
}

// Background and initials colour, each pair readable (the avatar palette).
const TEACHER_COLORS: [string, string][] = [
  ['#122D47', '#f5efe3'],
  ['#B65D3C', '#f5efe3'],
  ['#CB9725', '#122D47'],
  ['#7D9B81', '#122D47'],
  ['#97C1D5', '#122D47'],
  ['#7A4590', '#ffffff'],
];

type AvatarProps = { kind: 'student' | 'teacher'; firstName: string; lastName: string; id: number; size?: number };

export function Avatar({ kind, firstName, lastName, id, size = 44 }: AvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (kind === 'student') {
    const n = String(avatarIndex(firstName) + 1).padStart(2, '0');
    return <img src={`/avatars/${n}.webp`} alt="" width={size} height={size} style={circle} className="shrink-0 object-cover" />;
  }
  const [bg, fg] = TEACHER_COLORS[Math.abs(id) % TEACHER_COLORS.length]!;
  const initials = `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase();
  return (
    // A hairline ring keeps a navy circle visible on the dark theme's navy ground.
    <div aria-hidden="true" className="flex shrink-0 items-center justify-center border border-line font-title font-semibold" style={{ ...circle, backgroundColor: bg, color: fg, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}
