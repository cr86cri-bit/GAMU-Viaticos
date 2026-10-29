"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

type Kind = "success" | "error" | "warning" | "info";
type Notice = { id: number; kind: Kind; text: string };
type Notify = (text: string, kind?: Kind) => void;
const NotificationContext = createContext<Notify | null>(null);

const styles: Record<Kind, { box: string; icon: string; title: string }> = {
  success: {
    box: "bg-emerald-700 border-emerald-400 text-white",
    icon: "text-emerald-100",
    title: "Operación exitosa",
  },
  error: {
    box: "bg-red-700 border-red-400 text-white",
    icon: "text-red-100",
    title: "Ocurrió un error",
  },
  warning: {
    box: "bg-amber-500 border-amber-300 text-slate-950",
    icon: "text-amber-950",
    title: "Atención",
  },
  info: {
    box: "bg-blue-700 border-blue-400 text-white",
    icon: "text-blue-100",
    title: "Información",
  },
};

function NotificationItem({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(notice.id), 4500);
    return () => window.clearTimeout(timer);
  }, [notice.id, onClose]);

  const Icon =
    notice.kind === "error"
      ? AlertCircle
      : notice.kind === "success"
        ? CheckCircle2
        : notice.kind === "warning"
          ? TriangleAlert
          : Info;
  const variant = styles[notice.kind];

  return (
    <div
      role={notice.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border-2 p-4 pr-12 shadow-2xl ${variant.box}`}
    >
      <Icon size={26} className={`mt-0.5 shrink-0 ${variant.icon}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">{variant.title}</p>
        <p className="mt-1 break-words text-sm font-medium leading-relaxed">{notice.text}</p>
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => onClose(notice.id)}
        className="absolute right-3 top-3 rounded-lg p-1.5 transition hover:bg-black/15 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X size={19} />
      </button>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-black/15" />
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sequence = useRef(0);
  const recent = useRef<Map<string, number>>(new Map());

  const close = useCallback((id: number) => {
    setNotices((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback<Notify>((rawText, kind = "info") => {
    const text = rawText.trim();
    if (!text) return;

    const now = Date.now();
    const key = `${kind}:${text}`;
    const last = recent.current.get(key) ?? 0;
    // Evita el doble mensaje por StrictMode, Alert repetidos o eventos simultáneos.
    if (now - last < 1800) return;
    recent.current.set(key, now);
    for (const [entry, timestamp] of recent.current) {
      if (now - timestamp > 10000) recent.current.delete(entry);
    }

    const id = ++sequence.current;
    setNotices((items) => [...items.slice(-3), { id, kind, text }]);
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      {mounted && createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[99999] flex flex-col gap-3 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 sm:w-[410px]"
          style={{ zIndex: 99999, isolation: "isolate" }}
        >
          {notices.map((notice) => (
            <NotificationItem key={notice.id} notice={notice} onClose={close} />
          ))}
        </div>,
        document.body
      )}
    </NotificationContext.Provider>
  );
}

export function useNotify(): Notify {
  return useContext(NotificationContext) ?? (() => {});
}
