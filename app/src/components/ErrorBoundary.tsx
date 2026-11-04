import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { Button } from './Button';
import { Notice } from './Notice';

// What a page shows when it crashes, instead of a blank screen: what
// happened and a way on. A page that can't load its code after a deploy (its
// file name changed) is told to reload; main.tsx reloads once on its own.

const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(e.message);

type Props = { children: ReactNode; resetKey: string };
type State = { error: unknown };

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // Another page: try again.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-16">
        <Notice
          tone={chunk ? 'info' : 'error'}
          title={chunk ? 'SATMAKON was updated' : 'Something went wrong on this page'}
          message={chunk ? 'Reload to get the new version. Your answers and progress are kept.' : 'Reload the page. If it keeps happening, tell your teacher what you were doing.'}
        />
        <Button label="Reload" onClick={() => window.location.reload()} />
        <Button label="Back to the start" variant="plain" onClick={() => window.location.assign('/')} />
      </div>
    );
  }
}

/** Catches a page's crash; going to another page clears it. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
