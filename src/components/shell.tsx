"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, Users, MapPinned, Layers, Route, FileSpreadsheet,
  Wallet, LogOut, Settings, BriefcaseBusiness, Receipt, Menu, X,
  Building2, ChevronLeft, ChevronRight, Sun, Moon,
} from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  ["/dashboard", "Inicio", LayoutDashboard],
  ["/funcionarios", "Funcionarios", Users],
  ["/cargos", "Cargos", BriefcaseBusiness],
  ["/direcciones", "Direcciones", Building2],
  ["/categorias", "Categorías", Layers],
  ["/destinos", "Destinos", MapPinned],
  ["/tarifas", "Tarifas", Settings],
  ["/viajes", "Viajes", Route],
  ["/planillas", "Planillas", FileSpreadsheet],
  ["/presupuestos", "Presupuestos", Wallet],
  ["/reportes", "Reportes", Receipt],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("gamu-theme");
    const enabled = saved === "dark";
    document.documentElement.classList.toggle("gamu-dark", enabled);
    setDark(enabled);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("gamu-dark", next);
    window.localStorage.setItem("gamu-theme", next ? "dark" : "light");
  };

  const logout = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-[272px] flex-col border-r border-[#4A5C6A]/45 gamu-sidebar shadow-xl transition-[width,transform] duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 lg:shadow-none lg:self-start ${collapsed ? "lg:w-[76px]" : "lg:w-[272px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`relative flex min-h-[92px] items-center border-b border-[var(--g-border)]/35 ${collapsed ? "lg:justify-center lg:px-2" : "px-4"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <img src="/escudo-gamu.png" alt="Escudo GAMU" className="h-14 w-11 shrink-0 object-contain" />
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-base font-bold tracking-tight text-[var(--foreground)]">GAMU Viáticos</p>
              <p className="mt-0.5 text-[10px] leading-snug gamu-muted">Gobierno Autónomo Municipal de Uyuni</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={19} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="absolute -right-3 top-[36px] z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-[#9BA8AB]/45 gamu-sidebar-toggle shadow-md transition hover:border-slate-300 hover:bg-slate-50 lg:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav aria-label="Navegación principal" className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-5 ${collapsed ? "lg:px-2" : "px-3"}`}>
          <p className={`mb-3 px-3 text-[10px] font-bold tracking-[0.16em] gamu-muted ${collapsed ? "lg:sr-only" : ""}`}>
            MENÚ PRINCIPAL
          </p>
          {nav.map(([href, label, Icon]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "gamu-sidebar-active font-semibold" : "gamu-sidebar-link"}`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.9} className="shrink-0" />
                <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-[var(--g-border)]/35 py-3 ${collapsed ? "lg:px-2" : "px-3"}`}>
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Cerrar sesión" : undefined}
            aria-label="Cerrar sesión"
            className={`gamu-sidebar-logout flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setMobileOpen(false)}
          className="no-print fixed inset-0 z-30 bg-black/45 lg:hidden"
        />
      )}

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 gamu-topbar border-b px-4 sm:px-8">
          <button
            type="button"
            className="rounded-lg p-1 gamu-text hover:opacity-80 lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={23} />
          </button>
          <img src="/escudo-gamu.png" alt="Escudo GAMU" className="h-10 w-8 object-contain lg:hidden" />
          <span className="font-semibold">Sistema de Pasajes y Viáticos</span>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={toggleTheme} aria-label={dark ? "Desactivar modo oscuro" : "Activar modo oscuro"} aria-pressed={dark} title={dark ? "Modo claro" : "Modo oscuro"} className="theme-toggle inline-flex h-10 items-center gap-2 rounded-xl border border-[#9BA8AB]/60 px-3 text-sm font-medium transition-colors hover:bg-[#9BA8AB]/25">
              {dark ? <Sun size={18}/> : <Moon size={18}/>}
              <span className="hidden sm:inline">{dark ? "Modo claro" : "Modo oscuro"}</span>
            </button>
            <span className="hidden text-xs gamu-muted sm:block">Gestión 2026</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 pb-28 sm:p-7 lg:pb-8">{children}</main>
        <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gamu-bottomnav border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
          {[nav[0], nav[1], nav[6], nav[7], nav[9]].map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] ${pathname.startsWith(href) ? "font-bold gamu-bottomnav-active" : "gamu-muted"}`}
            >
              <Icon size={21} />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
