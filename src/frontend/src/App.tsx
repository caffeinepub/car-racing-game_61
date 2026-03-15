import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CarRacingGame from "./components/CarRacingGame";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CarRacingGame />
    </QueryClientProvider>
  );
}
