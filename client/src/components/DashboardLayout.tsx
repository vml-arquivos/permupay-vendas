/**
 * DashboardLayout.tsx — Painel Administrativo "Silent Wealth"
 * Topbar horizontal (sem sidebar). Logo PNG real. Fundo alabaster.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, Package, Calculator, Layers, Store,
  Users, Settings, LogOut, Warehouse, BarChart3, Heart,
  ExternalLink, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// ── Logo PNG ──────────────────────────────────────────────────────────────────
const LOGO_DARK = "data:image/png;base64,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";

// ── Menu ──────────────────────────────────────────────────────────────────────
const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard",       path: "/dashboard"     },
  { icon: Package,         label: "Produtos",         path: "/produtos"      },
  { icon: Warehouse,       label: "Estoque",          path: "/estoque"       },
  { icon: Calculator,      label: "Simulações",       path: "/simulacoes"    },
  { icon: Layers,          label: "Lotes",            path: "/lotes"         },
  { icon: Heart,           label: "Lista de Desejos", path: "/desejos-admin" },
  { icon: BarChart3,       label: "Relatórios",       path: "/relatorios"    },
];
const adminItems = [
  { icon: Users,    label: "Usuários",      path: "/usuarios"      },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6]">
        <div className="text-center space-y-6 p-10 max-w-sm w-full">
          <img src={LOGO_DARK} alt="Shoop Permupay" className="h-16 mx-auto" />
          <p className="text-sm text-neutral-500">Acesso restrito ao painel administrativo.</p>
          <Button onClick={() => { window.location.href = "/login"; }} size="lg"
            className="w-full bg-neutral-900 hover:bg-neutral-700 text-white text-[11px] tracking-[0.15em] uppercase font-semibold">
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardContent>{children}</DashboardContent>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  const allItems = [...menuItems, ...(isAdmin ? adminItems : [])];

  const NavLink = ({ item }: { item: typeof menuItems[0] }) => {
    const isActive = location === item.path || location.startsWith(item.path + "/");
    return (
      <button
        onClick={() => { setLocation(item.path); setMobileOpen(false); }}
        className={`flex items-center gap-2 px-3 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase transition-all whitespace-nowrap ${
          isActive
            ? "text-neutral-900 border-b-2 border-neutral-900"
            : "text-neutral-400 border-b-2 border-transparent hover:text-neutral-700"
        }`}
      >
        <item.icon className="w-3 h-3 shrink-0" />
        {item.label}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">

      {/* ── TOPBAR ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        {/* Linha 1: Logo + User */}
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => setLocation("/dashboard")} className="shrink-0">
            <img src={LOGO_DARK} alt="Shoop Permupay" className="h-9 object-contain" />
          </button>

          {/* Direita: Vitrine + Usuário */}
          <div className="flex items-center gap-4">
            <a href="/vitrine" target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors border border-neutral-200 hover:border-neutral-400 px-3 py-1.5">
              <Store className="w-3 h-3" />
              Vitrine
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </a>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
                  <Avatar className="h-7 w-7 border border-neutral-200">
                    <AvatarFallback className="text-[10px] font-bold bg-neutral-100 text-neutral-600">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-[11px] font-medium text-neutral-700 max-w-[120px] truncate">
                    {user?.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white border-neutral-200 shadow-lg">
                <div className="px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-neutral-800">{user?.name}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-neutral-100" />
                <DropdownMenuItem onClick={() => setLocation("/configuracoes")}
                  className="cursor-pointer text-[12px] text-neutral-600 hover:text-neutral-900 focus:bg-neutral-50">
                  <Settings className="mr-2 h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-neutral-100" />
                <DropdownMenuItem onClick={logout}
                  className="cursor-pointer text-[12px] text-rose-500 focus:text-rose-600 focus:bg-rose-50">
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile: hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Linha 2: Navegação (desktop) */}
        <nav className="hidden sm:flex max-w-screen-xl mx-auto px-4 border-t border-neutral-50 overflow-x-auto no-scrollbar h-10 items-end gap-1">
          {allItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-white pt-28">
          <nav className="px-6 space-y-1">
            {allItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>
        </div>
      )}

      {/* ── PAGE CONTENT ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
