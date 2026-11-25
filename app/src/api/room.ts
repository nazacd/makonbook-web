import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RoomSlot } from '@/components/room/items';
import { usePerson } from '@/lib/practice/hooks';

import { api, call, type Schemas } from './client';

// Mako's room (spec 28): six slots, an item in each; the server says what is
// unlocked (from the figures of spec 27) and keeps what is placed. Cosmetic
// only. Anything that earns XP can unlock an item, so the room is read under
// the ['gamification'] key and refetched with it.

export type Room = Schemas['Room'];
export type RoomSlotData = Room['slots'][number];
export type RoomItem = RoomSlotData['items'][number];

export const roomKey = (person: string) => ['gamification', person, 'room'] as const;

export function useRoom(enabled = true) {
  const person = usePerson();
  return useQuery({ queryKey: roomKey(person), enabled, queryFn: () => call(api.GET('/v1/me/room')), staleTime: 30_000 });
}

/** The item placed in each slot. */
export function equippedOf(room: Room): Record<RoomSlot, string> {
  const out = {} as Record<RoomSlot, string>;
  for (const s of room.slots) out[s.key] = s.items.find((i) => i.equipped)?.code ?? s.items[0]?.code ?? '';
  return out;
}

/** The unlocked items not shown yet. */
export const newItems = (room: Room): RoomItem[] => room.slots.flatMap((s) => s.items.filter((i) => i.is_new));

/** Places an item: shown at once, put back if the server says no. */
export function useEquip() {
  const person = usePerson();
  const queryClient = useQueryClient();
  const key = roomKey(person);
  return useMutation({
    mutationFn: ({ slot, item }: { slot: RoomSlot; item: string }) => call(api.PUT('/v1/me/room/slots/{slot}', { params: { path: { slot } }, body: { item } })),
    onMutate: async ({ slot, item }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Room>(key);
      if (before) queryClient.setQueryData<Room>(key, { ...before, slots: before.slots.map((s) => (s.key === slot ? { ...s, items: s.items.map((i) => ({ ...i, equipped: i.code === item })) } : s)) });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
    },
    onSuccess: (room) => queryClient.setQueryData(key, room),
  });
}

/** Marks the new items as shown, on the server (the room page keeps its own "New" tags until it is left). */
export function useSeenRoom() {
  return useMutation({ mutationFn: () => call(api.POST('/v1/me/room/seen')) });
}
