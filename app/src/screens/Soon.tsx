import { BookOpen, Layers } from 'lucide-react';

import { EmptyState } from '@/components/States';
import { useTitle } from '@/lib/title';

// Practice and Words arrive with the next milestones; until then the tabs say so.
export function PracticeSoon() {
  useTitle('Practice');
  return <EmptyState icon={Layers} title="Practice is coming to the web" message="Until then, practice tests are in the MakonBook app on your phone." />;
}

export function WordsSoon() {
  useTitle('Words');
  return <EmptyState icon={BookOpen} title="Words is coming to the web" message="Until then, your vocabulary is in the MakonBook app on your phone." />;
}
