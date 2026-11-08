import { useState } from 'react';

import { useSaveProfile } from '@/api/accounts';
import { describeError } from '@/api/errors';
import type { Profile } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { Action, Modal } from '@/components/ui';

// Your own name. Once changed here it stays, whatever the office's records
// say; classes and attendance still come from the office.
export function EditProfile({ profile, onClose, onPhoto }: { profile: Profile; onClose: () => void; onPhoto: () => void }) {
  const save = useSaveProfile();
  const [first, setFirst] = useState(profile.first_name);
  const [last, setLast] = useState(profile.last_name);
  const ok = first.trim() !== '' && last.trim() !== '' && first.trim().length <= 60 && last.trim().length <= 60;
  return (
    <Modal
      title="Edit profile"
      subtitle="This is how teachers and classmates see you."
      onClose={onClose}
      width={480}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action onClick={() => save.mutate({ first_name: first.trim(), last_name: last.trim() }, { onSuccess: onClose })} disabled={!ok || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Action>
        </>
      }>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar kind={profile.kind} firstName={profile.first_name} lastName={profile.last_name} id={profile.id} size={56} photo={profile.photo_url} />
          <button type="button" onClick={onPhoto} className="t-subhead font-bold text-accent hover:underline">
            {profile.photo_url ? 'Change photo' : 'Add a photo'}
          </button>
        </div>
        <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
        <TextField label="Surname" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
        {save.isError && <Notice tone="error" message={describeError(save.error)} />}
      </div>
    </Modal>
  );
}
