// Fictional Mako's room (spec 28) for the mock: the API's catalogue, what a
// login placed and what it has been shown, unlocked from the mock ledger's
// figures (mock/gamification.cjs). The shapes are the contract's.

const SLOTS = [['wallpaper', 'Wallpaper'], ['art', 'Wall art'], ['rug', 'Rug'], ['desk', 'Furniture'], ['corner', 'Light'], ['plant', 'Plant']];
// code, slot, name, blurb, the figure, the target (no figure: the slot's default)
const ITEMS = [
  ['wp_lavender', 'wallpaper', 'Lavender wall', 'Calm and quiet: a good start.'],
  ['wp_ikat', 'wallpaper', 'Atlas ikat', 'The flowing silk pattern of Margilan atlas.', 'level', 3],
  ['wp_girih', 'wallpaper', 'Girih tiles', "Eight-point stars from Samarkand's madrasas.", 'best_streak', 7],
  ['wp_night', 'wallpaper', 'Starry night', 'For night-owl study sessions.', 'level', 8],
  ['art_cork', 'art', 'Study board', 'Notes, plans and a photo or two.'],
  ['art_suzani', 'art', 'Suzani', 'Hand-embroidered suns from Bukhara.', 'reviews', 100],
  ['art_registan', 'art', 'Registan print', 'Three madrasas under a blue sky.', 'level', 5],
  ['art_map', 'art', 'World map', "Pick where you'll study next.", 'xp_total', 1000],
  ['rug_mat', 'rug', 'Round mat', 'Soft, simple, comfy.'],
  ['rug_bukhara', 'rug', 'Bukhara gilam', 'A deep red carpet with gul medallions.', 'best_streak', 3],
  ['rug_atlas', 'rug', 'Atlas runner', 'Ikat colours under your feet.', 'quests', 5],
  ['desk_study', 'desk', 'Study desk', 'Laptop, books and a warm mug.'],
  ['desk_tapchan', 'desk', 'Tapchan and choynak', 'Tea, cushions and long conversations.', 'quests', 15],
  ['desk_scholar', 'desk', "Scholar's desk", 'Big desk, open book, serious plans.', 'level', 10],
  ['corner_lamp', 'corner', 'Floor lamp', 'Warm light for evening practice.'],
  ['corner_chiroq', 'corner', 'Chiroq lantern', 'Pierced metal and coloured glass.', 'quests', 25],
  ['corner_globe', 'corner', 'Globe', 'The world is waiting.', 'reviews', 500],
  ['plant_cactus', 'plant', 'Cactus', 'Low maintenance, high spirit.'],
  ['plant_tulips', 'plant', 'Tulips', 'Lola: the first flowers of spring.', 'reviews', 250],
  ['plant_anor', 'plant', 'Pomegranate tree', 'Anor: a sign of plenty and patience.', 'level', 12],
].map(([code, slot, name, blurb, key, target]) => ({ code, slot, name, blurb, key: key || null, target: target || 0 }));

const n = (x) => x.toLocaleString('en-US');
const LABEL = { xp_total: (t) => `Earn ${n(t)} XP`, level: (t) => `Reach level ${t}`, best_streak: (t) => `Keep a ${t}-day streak`, reviews: (t) => `Review words ${n(t)} times`, quests: (t) => `Finish ${t} quests` };

const layouts = new Map(); // login -> { slots: { slot: code }, seen: Set(code) }
const layout = (login) => { if (!layouts.has(login)) layouts.set(login, { slots: {}, seen: new Set() }); return layouts.get(login); };
const open = (it, f) => !it.key || (f[it.key] || 0) >= it.target;

function room(login, f) {
  const L = layout(login);
  let unlocked = 0;
  const slots = SLOTS.map(([key, label]) => {
    const mine = ITEMS.filter((i) => i.slot === key);
    const chosen = mine.find((i) => i.code === L.slots[key] && open(i, f)) || mine.find((i) => !i.key);
    return { key, label, items: mine.map((it) => {
      const ok = open(it, f); if (ok) unlocked++;
      return { code: it.code, name: it.name, blurb: it.blurb, unlocked: ok, equipped: it === chosen, is_new: ok && !!it.key && !L.seen.has(it.code),
        requirement: it.key ? { key: it.key, target: it.target, progress: Math.min(it.target, f[it.key] || 0), label: LABEL[it.key](it.target) } : null };
    }) };
  });
  return { level: f.level, items_unlocked: unlocked, items_total: ITEMS.length, slots };
}

/** Handles /v1/me/room…; true when it answered. `f` is the login's figures. */
function route(url, req, res, json, err, login, body, f) {
  if (url === '/v1/me/room' && req.method === 'GET') { json(res, 200, room(login, f)); return true; }
  if (url === '/v1/me/room/seen' && req.method === 'POST') {
    const L = layout(login);
    for (const it of ITEMS) if (it.key && open(it, f)) L.seen.add(it.code);
    json(res, 200, room(login, f)); return true;
  }
  const m = /^\/v1\/me\/room\/slots\/([a-z]+)$/.exec(url);
  if (m && req.method === 'PUT') {
    const it = ITEMS.find((i) => i.code === body.item);
    if (!it || it.slot !== m[1]) { err(res, 422, 'invalid_room_item', 'no such item for this slot'); return true; }
    if (!open(it, f)) { err(res, 403, 'room_item_locked', "this item isn't unlocked yet"); return true; }
    layout(login).slots[m[1]] = it.code;
    json(res, 200, room(login, f)); return true;
  }
  return false;
}

module.exports = { route };
