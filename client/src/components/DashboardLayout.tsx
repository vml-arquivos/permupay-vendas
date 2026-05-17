/**
 * DashboardLayout.tsx — Painel Administrativo "Silent Wealth" · Shoop Permupay
 * Refatorado: sidebar grafite profundo, topbar alabastro escuro, tipografia editorial.
 * LÓGICA DE AUTENTICAÇÃO, ROTAS E HOOKS INTACTOS — apenas visual alterado.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, Package, Calculator, Layers, Store,
  Users, Settings, LogOut, PanelLeft, Warehouse,
  BarChart3, Heart, ExternalLink, ChevronRight,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

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

const SIDEBAR_WIDTH_KEY = "permupay-sidebar-width";
const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

// ── Paleta dark premium ───────────────────────────────────────────────────────
// bg-sidebar:    #111110
// bg-active:     #1E1E1B
// border:        #222220
// text-primary:  #E8E3D8
// text-muted:    #5A5A52
// accent-gold:   #C8B99A

// ── Logo inline ───────────────────────────────────────────────────────────────
function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 w-full">
      <button className="shrink-0 w-7 h-7 flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
          <rect width="34" height="34" rx="7" fill="#0F0F0E"/>
          <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5Z" fill="#E8E3D8"/>
          <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5Z" fill="#7A7268"/>
        </svg>
      </button>
      {!collapsed && (
        <div className="leading-none min-w-0">
          <span className="block text-[7px] text-[#4A4A44] tracking-[0.35em] uppercase font-medium">Shop</span>
          <span className="block text-[11px] font-black tracking-[0.2em] text-[#E8E3D8] truncate">PERMAPAY</span>
        </div>
      )}
    </div>
  );
}

// ── Componente raiz ───────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "#111110" }}>
        <div className="text-center space-y-6 p-8 max-w-sm w-full border border-[#222220]" style={{ backgroundColor: "#0F0F0E" }}>
          <div>
            <p className="text-[8px] tracking-[0.3em] uppercase text-[#4A4A44] mb-4">Shoop Permupay</p>
            <h1 className="text-lg font-light text-[#E8E3D8] tracking-wide">Acesso restrito</h1>
            <p className="text-sm text-[#4A4A44] mt-2 font-light">Faça login para acessar o painel.</p>
          </div>
          <Button
            onClick={() => { window.location.href = "/login"; }}
            className="w-full bg-[#C8B99A] hover:bg-[#E8E3D8] text-[#0F0F0E] text-[9px] font-bold tracking-[0.22em] uppercase rounded-none h-11 border-0"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardContent>
    </SidebarProvider>
  );
}

// ── Inner content ─────────────────────────────────────────────────────────────
function DashboardContent({
  children, setSidebarWidth,
}: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const mu = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", mm);
      document.addEventListener("mouseup", mu);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", mm);
      document.removeEventListener("mouseup", mu);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const allItems = [...menuItems, ...adminItems];
  const active = allItems.find(i => location.startsWith(i.path));
  const breadcrumb = buildBreadcrumb(location, active?.label);

  return (
    <>
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-[#1E1E1B]"
          style={{ backgroundColor: "#0F0F0E" } as CSSProperties}
          disableTransition={isResizing}
        >
          {/* Header */}
          <SidebarHeader
            className="h-14 justify-center border-b border-[#1E1E1B]"
            style={{ backgroundColor: "#0F0F0E" }}
          >
            <div className="flex items-center w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-[#1A1A17] transition-colors focus:outline-none ml-1 mr-0.5 shrink-0"
              >
                <PanelLeft className="h-3.5 w-3.5 text-[#4A4A44]" />
              </button>
              <Logo collapsed={isCollapsed} />
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent
            className="gap-0 py-4"
            style={{ backgroundColor: "#0F0F0E" }}
          >
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => {
                const isActive = location.startsWith(item.path);
                const isWishlist = item.label === "Lista de Desejos";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-8 font-normal rounded-sm transition-colors text-[11px] tracking-wide ${
                        isActive
                          ? "text-[#C8B99A] font-medium"
                          : "text-[#4A4A44] hover:text-[#E8E3D8]"
                      }`}
                      style={{
                        backgroundColor: isActive ? "#1A1A17" : "transparent",
                      }}
                    >
                      <item.icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? "text-[#C8B99A]" : isWishlist ? "text-[#8A7A6A]" : "text-[#3A3A34]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {isAdmin && (
              <div className="mt-4">
                {!isCollapsed && (
                  <p className="px-4 text-[8px] font-semibold tracking-[0.3em] uppercase text-[#3A3A34] mb-2">
                    Administração
                  </p>
                )}
                {isCollapsed && <div className="mx-3 my-3 border-t border-[#1E1E1B]" />}
                <SidebarMenu className="px-2 gap-0.5">
                  {adminItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-8 font-normal rounded-sm transition-colors text-[11px] tracking-wide ${
                            isActive ? "text-[#C8B99A] font-medium" : "text-[#4A4A44] hover:text-[#E8E3D8]"
                          }`}
                          style={{ backgroundColor: isActive ? "#1A1A17" : "transparent" }}
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#C8B99A]" : "text-[#3A3A34]"}`} />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter
            className="p-2 border-t border-[#1E1E1B] space-y-1"
            style={{ backgroundColor: "#0F0F0E" }}
          >
            {/* Ver Vitrine */}
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-2.5 py-2 rounded-sm hover:bg-[#1A1A17] transition-colors w-full text-[10px] font-medium text-[#4A4A44] hover:text-[#7A7268] ${isCollapsed ? "justify-center" : ""}`}
              title="Ver Vitrine Pública"
            >
              <Store className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <>
                <span className="flex-1 truncate tracking-wide">Ver Vitrine</span>
                <ExternalLink className="h-3 w-3 opacity-30" />
              </>}
            </a>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-sm hover:bg-[#1A1A17] transition-colors w-full text-left focus:outline-none ${isCollapsed ? "justify-center" : ""}`}
                >
                  <Avatar className="h-6 w-6 shrink-0 border border-[#2A2A26] rounded-sm">
                    <AvatarFallback className="text-[9px] font-bold rounded-sm" style={{ backgroundColor: "#1A1A17", color: "#C8B99A" }}>
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#E8E3D8] truncate leading-none tracking-wide">{user?.name || "—"}</p>
                      <p className="text-[9px] text-[#3A3A34] truncate mt-0.5 font-light">{user?.email || "—"}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 border-[#2A2A26] shadow-2xl rounded-sm"
                style={{ backgroundColor: "#111110" }}
              >
                <div className="px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-[#E8E3D8] tracking-wide">{user?.name}</p>
                  <p className="text-[9px] text-[#4A4A44] font-light mt-0.5">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-[#1E1E1B]" />
                <DropdownMenuItem
                  onClick={() => setLocation("/configuracoes")}
                  className="cursor-pointer text-[11px] text-[#5A5A52] hover:text-[#E8E3D8] focus:bg-[#1A1A17] tracking-wide"
                >
                  <Settings className="mr-2 h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#1E1E1B]" />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-[11px] text-rose-700 hover:text-rose-400 focus:bg-rose-950/30 focus:text-rose-400 tracking-wide"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-px h-full cursor-col-resize hover:bg-[#C8B99A]/20 active:bg-[#C8B99A]/40 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────────────── */}
      <SidebarInset style={{ backgroundColor: "#141411" }}>
        {/* Topbar / Breadcrumb */}
        <div
          className="flex border-b border-[#1E1E1B] h-14 items-center px-6 sticky top-0 z-40 justify-between backdrop-blur-md"
          style={{ backgroundColor: "#111110CC" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <SidebarTrigger className="h-8 w-8 rounded-sm text-[#4A4A44] hover:bg-[#1A1A17] mr-1" />
            )}
            {!isMobile && (
              <SidebarTrigger className="h-7 w-7 rounded-sm text-[#4A4A44] hover:bg-[#1A1A17] mr-1" />
            )}
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-[10px] min-w-0">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-[#2E2E2A] shrink-0" />}
                  {crumb.href ? (
                    <button
                      onClick={() => setLocation(crumb.href!)}
                      className="text-[#3A3A34] hover:text-[#7A7268] transition-colors truncate tracking-wider"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-[#7A7268] font-medium truncate tracking-wider">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* Ver Vitrine */}
          <a
            href="/vitrine"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[8px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 border border-[#2A2A26] text-[#4A4A44] hover:border-[#C8B99A]/30 hover:text-[#C8B99A] transition-all"
          >
            <Store className="h-3 w-3" />
            Vitrine
            <ExternalLink className="h-2.5 w-2.5 opacity-40" />
          </a>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

// ── Breadcrumb builder ────────────────────────────────────────────────────────
function buildBreadcrumb(location: string, activeLabel?: string) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Shoop", href: "/dashboard" }];

  if (location.startsWith("/produtos") && location.includes("/editar")) {
    crumbs.push({ label: "Produtos", href: "/produtos" });
    crumbs.push({ label: "Editar Produto" });
  } else if (location === "/produtos/novo") {
    crumbs.push({ label: "Produtos", href: "/produtos" });
    crumbs.push({ label: "Novo Produto" });
  } else if (location.startsWith("/simulacoes/")) {
    crumbs.push({ label: "Simulações", href: "/simulacoes" });
    crumbs.push({ label: "Detalhe" });
  } else if (activeLabel) {
    crumbs.push({ label: activeLabel });
  }

  return crumbs;
}
