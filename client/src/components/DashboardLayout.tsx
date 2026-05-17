/**
 * DashboardLayout.tsx — Painel Administrativo "Silent Wealth" · Shoop Permupay
 * Refatorado: sidebar grafite profundo, topbar alabastro escuro, tipografia Montserrat + Lato.
 * Logo Shoop unificada — fundo transparente — consistente com vitrine pública.
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

// ── Logo Shoop Permupay — idêntica à vitrine pública ─────────────────────────
function ShoopLogo({ collapsed }: { collapsed: boolean }) {
  const gold = "#C8B99A";
  const goldMuted = "#6A5E50";

  if (collapsed) {
    // Apenas ícone quando sidebar colapsada
    return (
      <div className="flex items-center justify-center w-7 h-7 mx-auto">
        <svg width="26" height="26" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 24C8 13.507 16.507 5 27 5" stroke={goldMuted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M36 20C36 30.493 27.493 39 17 39" stroke={goldMuted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M11 23C11 15.268 17.268 9 25 9C32.732 9 39 15.268 39 23" stroke={gold} strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M39 13L39 23" stroke={gold} strokeWidth="2" strokeLinecap="round"/>
          <path d="M33 21C33 28.732 26.732 35 19 35C11.268 35 5 28.732 5 21" stroke={gold} strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M5 21L5 31" stroke={gold} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  return (
    <svg width="120" height="34" viewBox="0 0 130 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Shoop Permupay">
      {/* Ícone */}
      <g transform="translate(0, 1)">
        <path d="M4 20C4 11.163 11.163 4 20 4" stroke={goldMuted} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M32 17C32 25.837 24.837 33 16 33" stroke={goldMuted} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M7 19C7 13.477 11.477 9 17 9C22.523 9 27 13.477 27 19" stroke={gold} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M27 11L27 19" stroke={gold} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M29 18C29 23.523 24.523 28 19 28C13.477 28 9 23.523 9 18" stroke={gold} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M9 18L9 26" stroke={gold} strokeWidth="1.8" strokeLinecap="round"/>
      </g>
      {/* SHOOP */}
      <text x="40" y="21" fontFamily="'Montserrat', sans-serif" fontSize="12" fontWeight="700" letterSpacing="0.15em" fill="#E8E3D8">
        SHOOP
      </text>
      {/* PERMUPAY */}
      <text x="40" y="32" fontFamily="'Lato', sans-serif" fontSize="7" fontWeight="300" letterSpacing="0.32em" fill="#5A5A52">
        PERMUPAY
      </text>
    </svg>
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
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "#0F0F0E", fontFamily: "'Lato', sans-serif" }}
      >
        <div
          className="text-center space-y-7 p-8 max-w-sm w-full border border-[#1E1E1B]"
          style={{ backgroundColor: "#111110" }}
        >
          <div className="flex justify-center">
            <ShoopLogo collapsed={false} />
          </div>
          <div>
            <h1
              className="text-lg text-[#E8E3D8]"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.03em" }}
            >
              Acesso restrito
            </h1>
            <p
              className="text-sm text-[#4A4A44] mt-2"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
            >
              Faça login para acessar o painel.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = "/login"; }}
            className="w-full bg-[#C8B99A] hover:bg-[#D9CEBA] text-[#0F0F0E] rounded-none h-11 border-0"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.25em" }}
          >
            ENTRAR
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

  // Estilos de label comuns para menu items
  const menuLabelStyle: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 500,
    fontSize: "10px",
    letterSpacing: "0.06em",
  };

  return (
    <>
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-[#1A1A17]"
          style={{ backgroundColor: "#0A0A09" } as CSSProperties}
          disableTransition={isResizing}
        >
          {/* Header */}
          <SidebarHeader
            className="h-[60px] justify-center border-b border-[#1A1A17]"
            style={{ backgroundColor: "#0A0A09" }}
          >
            <div className="flex items-center w-full px-2">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-[#161614] transition-colors focus:outline-none shrink-0"
              >
                <PanelLeft className="h-3.5 w-3.5 text-[#3A3A34]" />
              </button>
              <div className="ml-2 flex-1 min-w-0 overflow-hidden">
                {!isCollapsed && <ShoopLogo collapsed={false} />}
              </div>
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent
            className="gap-0 py-4"
            style={{ backgroundColor: "#0A0A09" }}
          >
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-8 rounded-none transition-colors ${
                        isActive
                          ? "text-[#C8B99A]"
                          : "text-[#4A4A44] hover:text-[#B0A898]"
                      }`}
                      style={{
                        backgroundColor: isActive ? "#161614" : "transparent",
                        ...(isActive ? { borderLeft: "2px solid #C8B99A" } : { borderLeft: "2px solid transparent" }),
                      }}
                    >
                      <item.icon
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#C8B99A]" : "text-[#3A3A34]"}`}
                      />
                      <span className="truncate" style={menuLabelStyle}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {isAdmin && (
              <div className="mt-5">
                {!isCollapsed && (
                  <p
                    className="px-4 mb-2 text-[#2E2E2A] uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "7px", letterSpacing: "0.35em" }}
                  >
                    Administração
                  </p>
                )}
                {isCollapsed && <div className="mx-3 my-3 border-t border-[#1A1A17]" />}
                <SidebarMenu className="px-2 gap-0.5">
                  {adminItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-8 rounded-none transition-colors ${
                            isActive ? "text-[#C8B99A]" : "text-[#4A4A44] hover:text-[#B0A898]"
                          }`}
                          style={{
                            backgroundColor: isActive ? "#161614" : "transparent",
                            ...(isActive ? { borderLeft: "2px solid #C8B99A" } : { borderLeft: "2px solid transparent" }),
                          }}
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#C8B99A]" : "text-[#3A3A34]"}`} />
                          <span className="truncate" style={menuLabelStyle}>{item.label}</span>
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
            className="p-2 border-t border-[#1A1A17] space-y-0.5"
            style={{ backgroundColor: "#0A0A09" }}
          >
            {/* Ver Vitrine */}
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-2.5 py-2 hover:bg-[#161614] transition-colors w-full text-[#3A3A34] hover:text-[#7A7268] ${isCollapsed ? "justify-center" : ""}`}
              title="Ver Vitrine Pública"
            >
              <Store className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: "10px", letterSpacing: "0.06em" }}>
                    Ver Vitrine
                  </span>
                  <ExternalLink className="h-3 w-3 opacity-25" />
                </>
              )}
            </a>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2.5 px-2.5 py-2 hover:bg-[#161614] transition-colors w-full text-left focus:outline-none ${isCollapsed ? "justify-center" : ""}`}
                >
                  <Avatar className="h-6 w-6 shrink-0 border border-[#2A2A26] rounded-none">
                    <AvatarFallback
                      className="rounded-none text-[9px] font-bold"
                      style={{ backgroundColor: "#1A1A17", color: "#C8B99A", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[#E8E3D8] truncate leading-none"
                        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.04em" }}
                      >
                        {user?.name || "—"}
                      </p>
                      <p
                        className="text-[#3A3A34] truncate mt-0.5"
                        style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, fontSize: "9px" }}
                      >
                        {user?.email || "—"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 border-[#222220] shadow-2xl rounded-none"
                style={{ backgroundColor: "#0F0F0E" }}
              >
                <div className="px-3 py-2.5">
                  <p
                    className="text-[#E8E3D8]"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "11px" }}
                  >
                    {user?.name}
                  </p>
                  <p
                    className="text-[#4A4A44] mt-0.5"
                    style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, fontSize: "9px" }}
                  >
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator className="bg-[#1A1A17]" />
                <DropdownMenuItem
                  onClick={() => setLocation("/configuracoes")}
                  className="cursor-pointer text-[#5A5A52] hover:text-[#E8E3D8] focus:bg-[#161614] focus:text-[#E8E3D8]"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: "10px", letterSpacing: "0.04em" }}
                >
                  <Settings className="mr-2 h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#1A1A17]" />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-rose-700 hover:text-rose-400 focus:bg-rose-950/20 focus:text-rose-400"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: "10px", letterSpacing: "0.04em" }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-px h-full cursor-col-resize hover:bg-[#C8B99A]/15 active:bg-[#C8B99A]/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────────────── */}
      <SidebarInset style={{ backgroundColor: "#111110", fontFamily: "'Lato', sans-serif" }}>
        {/* Topbar / Breadcrumb */}
        <div
          className="flex border-b border-[#1A1A17] h-[60px] items-center px-6 sticky top-0 z-40 justify-between backdrop-blur-md"
          style={{ backgroundColor: "rgba(17,17,16,0.94)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <SidebarTrigger className="h-8 w-8 rounded-none text-[#3A3A34] hover:bg-[#161614]" />
            )}
            {!isMobile && (
              <SidebarTrigger className="h-7 w-7 rounded-none text-[#3A3A34] hover:bg-[#161614]" />
            )}
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 min-w-0">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-[#2A2A26] shrink-0" />}
                  {crumb.href ? (
                    <button
                      onClick={() => setLocation(crumb.href!)}
                      className="text-[#3A3A34] hover:text-[#7A7268] transition-colors truncate"
                      style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: "10px", letterSpacing: "0.06em" }}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className="text-[#8A8278] truncate"
                      style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.06em" }}
                    >
                      {crumb.label}
                    </span>
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
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#222220] text-[#4A4A44] hover:border-[#C8B99A]/30 hover:text-[#C8B99A] transition-all"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "7px", letterSpacing: "0.22em" }}
          >
            <Store className="h-3 w-3" />
            VITRINE
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
