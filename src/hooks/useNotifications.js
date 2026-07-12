import { useEffect, useState } from "react";
import { subscribe, notify as publish, history } from "../services/notificationService";

/**
 * useNotifications — subscribes the UI to the notification bus and keeps the
 * transient toast. `notify` is passed down into the order pipeline.
 */
export function useNotifications(toastMs = 3200) {
  const [items, setItems] = useState(history);
  const [toast, setToast] = useState(null);

  useEffect(() => subscribe((n) => {
    setItems((p) => [n, ...p].slice(0, 200));
    setToast(n);
  }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  return { items, toast, setToast, notify: publish };
}
