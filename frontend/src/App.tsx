import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Browser } from "@/components/browser";
import { Toaster } from "@/components/toaster";
import { ApiError } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (404, 403, 400) will not change on retry.
      retry: (n, err) => n < 2 && !(err instanceof ApiError && err.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Browser />
      <Toaster />
    </QueryClientProvider>
  );
}
