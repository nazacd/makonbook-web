import { BookOpen } from 'lucide-react';

import { EmptyState } from '@/components/States';
import { useTitle } from '@/lib/title';

// Words arrives with M3; until then the tab says so.
export function WordsSoon() {
  useTitle('Words');
  return <EmptyState icon={BookOpen} title="Words is coming to the web" message="Until then, your vocabulary is in the MakonBook app on your phone." />;
}
