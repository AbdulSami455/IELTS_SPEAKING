import { createContext, useContext } from "react";
import type { User } from "../../lib/api";

export interface UserContextValue {
  user: User | null;
  setUser: (user: User) => void;
}

export const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => undefined,
});

// The signed-in user, loaded once by RequireAuth.
export function useUser() {
  return useContext(UserContext);
}
