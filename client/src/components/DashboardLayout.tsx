import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Package,
  Calculator,
  Layers,
  ShoppingBag,
  Users,
  Settings,
  LogOut,
  PanelLeft,
  Warehouse,
  BarChart3,
  Heart,
  ExternalLink,
  Store,
  ClipboardList,
  CreditCard,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Package, label: "Produtos", path: "/produtos" },
  { icon: Warehouse, label: "Estoque", path: "/estoque" },
  { icon: Calculator, label: "Simulações", path: "/simulacoes" },
  { icon: Layers, label: "Lotes", path: "/lotes" },
  { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
  { icon: Heart, label: "Lista de Desejos", path: "/desejos-admin" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
];

const adminItems = [
  { icon: Users, label: "Usuários", path: "/usuarios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: CreditCard, label: "Pagamento", path: "/configuracoes-pagamento" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Acesso restrito
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Faça login para acessar o painel administrativo.
          </p>
          <Button onClick={() => { window.location.href = "/login"; }} size="lg" className="w-full">
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const activeLabel = [...menuItems, ...adminItems].find(i => location.startsWith(i.path))?.label ?? "Menu";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">P</span>
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">PermuPay</span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map(item => {
                const isActive = location === item.path || location.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 pt-4 pb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Administração</span>
                  </div>
                )}
                {isCollapsed && <div className="mx-4 my-2 border-t" />}
                <SidebarMenu className="px-2 gap-0.5">
                  {adminItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 font-normal"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/60 transition-colors w-full text-sm font-medium mb-1 ${isCollapsed ? "justify-center" : ""}`}
              title="Ver Vitrine Pública"
            >
              <Store className="h-4 w-4 text-primary shrink-0" />
              {!isCollapsed && (
                <span className="flex-1 truncate text-primary">Ver Vitrine</span>
              )}
              {!isCollapsed && <ExternalLink className="h-3 w-3 text-primary opacity-60" />}
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || "-"}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/configuracoes")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/configuracoes-pagamento")} className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Configurações de Pagamento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="flex border-b h-14 items-center gap-2 bg-background/95 px-4 backdrop-blur sticky top-0 z-40 justify-between">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            {!isMobile && <SidebarTrigger className="h-8 w-8 rounded-md text-muted-foreground" />}
            <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
            <span className="font-medium text-sm">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
            >
              <Store className="h-3.5 w-3.5" />
              Ver Vitrine
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </div>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
