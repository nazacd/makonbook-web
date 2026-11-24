// The achievements' pictures. An icon is one of the owner's 16-pixel items
// (`public/achievements/items/<name>.png`), drawn at a whole multiple of 16
// with hard pixels. In the tree it sits in a frame, one of the six images in
// `public/achievements/` (a square for an achievement, a rounded one for a
// goal, a jagged one for a challenge; grey once earned, purple until then);
// in toasts and in the list it stands alone.

export type FrameShape = 'advancement' | 'goal' | 'challenge';

export function ItemIcon({ name, size = 32, dim = false, className = '' }: { name: string; size?: number; /** Greyed, for one not yet earned. */ dim?: boolean; className?: string }) {
  return <img src={`/achievements/items/${name}.png`} alt="" width={size} height={size} draggable={false} className={`mc-item ${dim ? 'is-dim' : ''} ${className}`} />;
}

/** An icon in its frame: the shape says what kind it is, the colour whether it's earned. */
export function Badge({ icon, shape, done, size = 52, dim = false }: { icon: string; shape: FrameShape; done: boolean; size?: number; dim?: boolean }) {
  // The item at twice or three times its 16 pixels, whichever fits the frame.
  const item = size >= 76 ? 48 : 32;
  return (
    <span className="mc-badge" style={{ width: size, height: size }} aria-hidden="true">
      <img src={`/achievements/frame-${shape}-${done ? 'done' : 'todo'}.png`} alt="" draggable={false} />
      <ItemIcon name={icon} size={item} dim={dim} />
    </span>
  );
}
