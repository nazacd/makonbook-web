import { PageHeader } from '@/components/ui';
import { useTitle } from '@/lib/title';

export function Dashboard() {
  useTitle('Dashboard');
  return <PageHeader title="Dashboard" />;
}
