import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isAuthError, recoverFromExpiredSession } from "./lib/session-expiry";

export const getRouter = () => {
  // Any data fetch that fails because the login session expired is
  // auto-corrected: sign out + redirect to the sign-in page.
  const onCacheError = (error: unknown) => {
    if (isAuthError(error)) {
      void recoverFromExpiredSession({
        navigate: (to) => void router.navigate({ to }),
        invalidate: () => {
          void router.invalidate();
          void queryClient.invalidateQueries();
        },
      });
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onCacheError }),
    mutationCache: new MutationCache({ onError: onCacheError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
