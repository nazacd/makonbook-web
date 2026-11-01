import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';

import { ApiError } from '@/api/client';
import { Home } from '@/screens/Home';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry once when the network or the server failed; an answer the API
      // meant (401, 403 password_change_required, 429…) is final.
      retry: (count, error) =>
        count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
