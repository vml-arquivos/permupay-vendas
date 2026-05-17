/**
 * DashboardLayout.tsx — Painel Administrativo "Silent Wealth"
 * Layout limpo, navegação em sidebar compacta, topbar minimalista com breadcrumb.
 * Sem alteração de autenticação, rotas ou lógica de negócio.
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
  { icon: LayoutDashboard, label: "Dashboard",      path: "/dashboard"    },
  { icon: Package,         label: "Produtos",        path: "/produtos"     },
  { icon: Warehouse,       label: "Estoque",         path: "/estoque"      },
  { icon: Calculator,      label: "Simulações",      path: "/simulacoes"   },
  { icon: Layers,          label: "Lotes",           path: "/lotes"        },
  { icon: Heart,           label: "Lista de Desejos",path: "/desejos-admin"},
  { icon: BarChart3,       label: "Relatórios",      path: "/relatorios"   },
];
const adminItems = [
  { icon: Users,    label: "Usuários",      path: "/usuarios"      },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "permupay-sidebar-width";
const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

// ── Logo inline ───────────────────────────────────────────────────────────────
function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 w-full">
      <button className="shrink-0 w-7 h-7 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
          <rect width="34" height="34" rx="8" fill="#18181b"/>
          <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5Z" fill="#fafaf9"/>
          <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5Z" fill="#a1a1aa"/>
        </svg>
      </button>
      {!collapsed && (
        <div className="leading-none min-w-0">
          <span className="block text-[8px] text-neutral-500 tracking-[0.3em] uppercase font-medium">Shop</span>
          <span className="block text-[12px] font-black tracking-[0.18em] text-neutral-900 truncate">PERMAPAY</span>
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
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center space-y-5 p-8 max-w-sm w-full">
          <h1 className="text-xl font-semibold text-neutral-800">Acesso restrito</h1>
          <p className="text-sm text-neutral-500">Faça login para acessar o painel.</p>
          <Button onClick={() => { window.location.href = "/login"; }} size="lg" className="w-full bg-neutral-900 hover:bg-neutral-700">
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

  // Breadcrumb
  const allItems = [...menuItems, ...adminItems];
  const active = allItems.find(i => location.startsWith(i.path));
  const breadcrumb = buildBreadcrumb(location, active?.label);

  return (
    <>
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-neutral-100 bg-[#FAFAF9]" disableTransition={isResizing}>

          {/* Header */}
          <SidebarHeader className="h-14 justify-center border-b border-neutral-100 bg-[#FAFAF9]">
            <div className="flex items-center w-full">
              <button onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-neutral-100 rounded-md transition-colors focus:outline-none ml-1 mr-0.5 shrink-0">
                <PanelLeft className="h-3.5 w-3.5 text-neutral-400" />
              </button>
              <Logo collapsed={isCollapsed} />
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="gap-0 py-3 bg-[#FAFAF9]">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => {
                const isActive = location === item.path || location.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-8 font-normal rounded-md transition-colors text-[12px] ${
                        isActive
                          ? "bg-neutral-100 text-neutral-900 font-medium"
                          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                      }`}
                    >
                      <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-neutral-900" : "text-neutral-400"} ${item.label === "Lista de Desejos" ? "text-rose-400" : ""}`} />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {isAdmin && (
              <div className="mt-3">
                {!isCollapsed && (
                  <p className="px-4 text-[9px] font-semibold tracking-[0.22em] uppercase text-neutral-400 mb-1.5">
                    Administração
                  </p>
                )}
                {isCollapsed && <div className="mx-3 my-2 border-t border-neutral-100" />}
                <SidebarMenu className="px-2 gap-0.5">
                  {adminItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-8 font-normal rounded-md transition-colors text-[12px] ${
                            isActive ? "bg-neutral-100 text-neutral-900 font-medium" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                          }`}
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-neutral-900" : "text-neutral-400"}`} />
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
          <SidebarFooter className="p-2 border-t border-neutral-100 bg-[#FAFAF9] space-y-1">
            {/* Ver Vitrine */}
            <a href="/vitrine" target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-neutral-50 transition-colors w-full text-[11px] font-medium text-neutral-500 hover:text-neutral-800 ${isCollapsed ? "justify-center" : ""}`}
              title="Ver Vitrine Pública">
              <Store className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <>
                <span className="flex-1 truncate">Ver Vitrine</span>
                <ExternalLink className="h-3 w-3 opacity-40" />
              </>}
            </a>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-neutral-50 transition-colors w-full text-left focus:outline-none ${isCollapsed ? "justify-center" : ""}`}>
                  <Avatar className="h-7 w-7 border border-neutral-200 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold bg-neutral-100 text-neutral-600">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-neutral-800 truncate leading-none">{user?.name || "—"}</p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">{user?.email || "—"}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white border-neutral-200 shadow-lg">
                <div className="px-3 py-2">
                  <p className="text-[12px] font-semibold text-neutral-800">{user?.name}</p>
                  <p className="text-[10px] text-neutral-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-neutral-100" />
                <DropdownMenuItem onClick={() => setLocation("/configuracoes")} className="cursor-pointer text-[12px] text-neutral-600 hover:text-neutral-900 focus:bg-neutral-50">
                  <Settings className="mr-2 h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-neutral-100" />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-[12px] text-rose-500 focus:text-rose-600 focus:bg-rose-50">
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-px h-full cursor-col-resize hover:bg-neutral-300 active:bg-neutral-400 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────────────── */}
      <SidebarInset className="bg-[#F8F8F7]">
        {/* Topbar / Breadcrumb */}
        <div className="flex border-b border-neutral-100 h-14 items-center px-6 bg-white/80 backdrop-blur-md sticky top-0 z-40 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && <SidebarTrigger className="h-8 w-8 rounded-md text-neutral-400 hover:bg-neutral-100 mr-1" />}
            {!isMobile && <SidebarTrigger className="h-7 w-7 rounded-md text-neutral-400 hover:bg-neutral-50 mr-1" />}
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-[11px] min-w-0">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-neutral-300 shrink-0" />}
                  {crumb.href ? (
                    <button onClick={() => setLocation(crumb.href!)}
                      className="text-neutral-400 hover:text-neutral-700 transition-colors truncate">
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-neutral-700 font-medium truncate">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* Ação rápida: Ver Vitrine */}
          <a href="/vitrine" target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] uppercase px-3 py-1.5 border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-800 transition-colors rounded-sm">
            <Store className="h-3 w-3" />
            Vitrine
            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
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
