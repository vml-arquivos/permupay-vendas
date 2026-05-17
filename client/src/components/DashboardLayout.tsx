/**
 * DashboardLayout.tsx — Painel Administrativo "Dark Luxury"
 * Navegação topbar minimalista, fundo negro, detalhes em ouro.
 * Lógica de Auth e Rotas preservada.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Acervo de Produtos", path: "/produtos" },
    { label: "Estoque", path: "/estoque" },
    { label: "Simulações", path: "/simulacoes" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* Topbar Minimalista "Dark Luxury" */}
      <header className="w-full bg-[#0A0A0A] border-b border-white/10 pt-8 pb-5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center gap-6">
          {/* Logo Centralizada (Use a versão com texto claro, se houver) */}
          <Link href="/dashboard">
            <img 
              src="/LOGO PERMUPAY2.png" 
              alt="SHOOP PERMUPAY" 
              className="h-10 md:h-12 object-contain cursor-pointer drop-shadow-md"
              onError={(e) => { e.currentTarget.src = "/LOGO PERMUPAY.png"; }}
            />
          </Link>

          {/* Navegação Editorial */}
          <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <a className={`font-semibold tracking-[0.15em] text-[10px] md:text-xs uppercase transition-colors duration-300 ${
                    isActive 
                      ? 'text-[#D4AF37] border-b border-[#D4AF37] pb-1' 
                      : 'text-neutral-500 hover:text-white'
                  }`}>
                    {item.label}
                  </a>
                </Link>
              );
            })}
            
            <span className="w-px h-3 bg-white/20"></span>

            <a href="/vitrine" target="_blank" rel="noopener noreferrer" className="font-semibold tracking-[0.15em] text-[10px] md:text-xs uppercase text-neutral-500 hover:text-[#D4AF37] transition-colors duration-300">
              Ver Vitrine
            </a>
            
            <button 
              onClick={() => logout.mutate()} 
              className="font-semibold tracking-[0.15em] text-[10px] md:text-xs uppercase text-neutral-500 hover:text-red-500 transition-colors duration-300 flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" /> Sair
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo da Página com Respiro */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 lg:p-16">
        {children}
      </main>
    </div>
  );
}
