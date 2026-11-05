import type { ReactNode } from "react";

/**
 * Montado uma vez na raiz. O cliente Better Auth não precisa de context
 * (`useSession` sozinho): hoje só repassa os filhos.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
