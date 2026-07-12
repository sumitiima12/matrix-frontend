import { useState } from "react";
import { lsGet, lsSet, getUserId } from "../lib/format";

/**
 * useAuth — who is using the app.
 *
 * A guest gets a stable local id so their paper trades survive a refresh.
 * Signing in with phone + PIN switches to a server-backed id, so history follows
 * them across devices.
 */
export function useAuth() {
  const [guestId] = useState(getUserId);
  const [auth, setAuth] = useState(() => lsGet("mx_auth", null));  // { phone, name } | null
  const [loginOpen, setLoginOpen] = useState(false);

  const userId = auth ? "ph_" + auth.phone : guestId;

  const login = (a) => {
    setAuth(a);
    lsSet("mx_auth", a);
    setLoginOpen(false);
  };

  const logout = () => {
    setAuth(null);
    lsSet("mx_auth", null);
  };

  return { auth, userId, guestId, isAuthed: Boolean(auth), loginOpen, setLoginOpen, login, logout };
}
