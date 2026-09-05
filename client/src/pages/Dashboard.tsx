import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Package,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Heart,
  TrendingUp,
  Store,
  BarChart3,
  ShoppingBag,
  ArrowRight,
  Boxes,
  Zap,
  RefreshCcw,
  Clock,
  DollarSign,
  ShoppingCart,
  Filter,
  X,
} from 'lucide-react';

// ── Filtros dinâmicos do dashboard ───────────────────────────────────────────
// Afetam apenas os KPIs derivados de pedidos (Aguardando/Vendas/Faturamento/
// Ticket Médio) — os KPIs de catálogo (Produtos, Simulações) não têm uma
// dimensão de data/pedido e continuam mostrando o total geral, por design.

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';
type StatusFilterValue = 'AGUARDANDO' | 'PAGO' | 'CANCELADO' | 'EXPIRADO' | '';

const STATUS_FILTER_TO_ENUM: Record<Exclude<StatusFilterValue, ''>, string[]> = {
  AGUARDANDO: ['AGUARDANDO_PAGAMENTO', 'RESERVADO'],
  PAGO: ['PAGO'],
  CANCELADO: ['CANCELADO'],
  EXPIRADO: ['EXPIRADO'],
};

const DATE_PRESET_OPTIONS: [DatePreset, string][] = [
  ['all', 'Todo o período'],
  ['today', 'Hoje'],
  ['yesterday', 'Ontem'],
  ['7d', 'Últimos 7 dias'],
  ['30d', 'Últimos 30 dias'],
  ['custom', 'Período personalizado…'],
];

const STATUS_FILTER_OPTIONS: [StatusFilterValue, string][] = [
  ['', 'Todos os status'],
  ['AGUARDANDO', 'Aguardando pagamento'],
  ['PAGO', 'Pago'],
  ['CANCELADO', 'Cancelado'],
  ['EXPIRADO', 'Expirado'],
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Resolve o preset de data para um instante absoluto (ISO), usando o fuso
 * horário local do navegador — é isso que garante que "hoje"/"ontem"/"7
 * dias" batem com o que o usuário vê no relógio dele, não com UTC do
 * servidor.
 */
function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string
): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (preset) {
    case 'all':
      return {};
    case 'today':
      return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { dateFrom: startOfDay(y).toISOString(), dateTo: endOfDay(y).toISOString() };
    }
    case '7d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
    }
    case '30d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
    }
    case 'custom': {
      if (!customFrom || !customTo) return {};
      const from = new Date(`${customFrom}T00:00:00`);
      const to = new Date(`${customTo}T23:59:59.999`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return {};
      return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
    }
  }
}

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, subtitle, icon: Icon, accent, href,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; accent: string; href?: string;
}) {
  const inner = (
    <div className={`relative bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 ${href ? 'cursor-pointer hover:shadow-md hover:border-primary/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground/40" />}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-foreground leading-none mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Alert Row ─────────────────────────────────────────────────────────────────
function AlertRow({ icon: Icon, label, value, severity }: {
  icon: React.ElementType; label: string; value: string | number; severity: 'ok' | 'warn' | 'danger';
}) {
  const c = {
    ok:     'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn:   'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  }[severity];
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium ${c}`}>
      <span className="flex items-center gap-2.5"><Icon className="w-4 h-4 shrink-0" />{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-6 h-6 opacity-40" />
      </div>
      <p className="text-sm text-center max-w-xs">{text}</p>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, action }: {
  title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function Dashboard() {
  // Estado dos filtros — inicializado a partir da URL para permitir
  // compartilhar/recarregar a página mantendo o mesmo filtro aplicado.
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [datePreset, setDatePreset] = useState<DatePreset>(
    (readParam(initial, 'periodo') as DatePreset) || 'all'
  );
  const [customFrom, setCustomFrom] = useState(readParam(initial, 'de'));
  const [customTo, setCustomTo] = useState(readParam(initial, 'ate'));
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(
    (readParam(initial, 'status') as StatusFilterValue) || ''
  );
  const [productId, setProductId] = useState(readParam(initial, 'produto'));
  const [sellerId, setSellerId] = useState(readParam(initial, 'vendedor'));
  const [customerId, setCustomerId] = useState(readParam(initial, 'cliente'));

  const productsQuery = trpc.products.list.useQuery();
  const sellersQuery = trpc.sellers.list.useQuery();
  const customersQuery = trpc.customers.list.useQuery({});

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const statusEnumValues = useMemo(
    () => (statusFilter ? STATUS_FILTER_TO_ENUM[statusFilter] : []),
    [statusFilter]
  );

  const filtersInput = useMemo(
    () => ({
      ...dateRange,
      status: statusEnumValues.length ? (statusEnumValues as any) : undefined,
      productId: productId ? [Number(productId)] : undefined,
      sellerId: sellerId ? [Number(sellerId)] : undefined,
      customerId: customerId ? [Number(customerId)] : undefined,
    }),
    [dateRange, statusEnumValues, productId, sellerId, customerId]
  );

  const hasActiveFilters =
    datePreset !== 'all' || !!statusFilter || !!productId || !!sellerId || !!customerId;

  // Mantém a URL sincronizada com os filtros (sem gerar entradas novas no
  // histórico do navegador a cada mudança).
  useEffect(() => {
    const params = new URLSearchParams();
    if (datePreset !== 'all') params.set('periodo', datePreset);
    if (datePreset === 'custom') {
      if (customFrom) params.set('de', customFrom);
      if (customTo) params.set('ate', customTo);
    }
    if (statusFilter) params.set('status', statusFilter);
    if (productId) params.set('produto', productId);
    if (sellerId) params.set('vendedor', sellerId);
    if (customerId) params.set('cliente', customerId);
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [datePreset, customFrom, customTo, statusFilter, productId, sellerId, customerId]);

  const clearFilters = () => {
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setStatusFilter('');
    setProductId('');
    setSellerId('');
    setCustomerId('');
  };

  const { data, isLoading, isFetching, error, refetch } = trpc.dashboard.useQuery(filtersInput);

  // Só mostra o skeleton de página inteira no primeiro carregamento — ao
  // trocar um filtro, mantém a página (e a barra de filtros) visível com um
  // indicador discreto de atualização, em vez de piscar tudo para skeleton.
  if (isLoading && !data) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-32" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold">Erro ao carregar dashboard</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <RefreshCcw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const d = data as any;
  const totalProducts   = d.totalProducts   ?? 0;
  const activeProducts  = d.activeProducts  ?? 0;
  const totalSims       = d.totalSimulations ?? 0;
  const attentionCount  = d.attentionCount  ?? 0;
  const healthyCount    = d.healthyCount    ?? 0;
  const wishlistNew     = d.wishlistCounts?.novo    ?? 0;
  const wishlistContact = d.wishlistCounts?.contato ?? 0;
  const recentSims      = (d.recentSimulations ?? []) as any[];
  const simTotal        = Math.max(totalSims, 1);
  // Dados de pedidos/vendas (integrados via getDashboardData)
  const ordersAguardando   = d.ordersAguardando       ?? 0;
  const ordersPagos        = d.ordersPagos            ?? 0;
  const faturamento        = d.faturamentoConfirmado  ?? 0;
  const ticketMedio        = d.ticketMedio            ?? 0;
  const fmtBrl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const diagColors: Record<string, string> = {
    EXCELENTE: 'bg-emerald-100 text-emerald-700',
    SAUDAVEL:  'bg-blue-100 text-blue-700',
    ATENCAO:   'bg-amber-100 text-amber-700',
    RISCO:     'bg-red-100 text-red-700',
    PREJUIZO:  'bg-red-200 text-red-800',
    PENDENTE:  'bg-stone-100 text-stone-600',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Painel de controle</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/produtos/novo">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Package className="w-3.5 h-3.5" /> Novo Produto
            </button>
          </Link>
          <a href="/vitrine" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors">
            <Store className="w-3.5 h-3.5" /> Ver Vitrine
          </a>
        </div>
      </div>

      {/* ── Filtros dinâmicos ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="w-4 h-4 text-primary" />
            Filtros
            {isFetching && !isLoading && (
              <span className="text-xs font-normal text-muted-foreground">(atualizando…)</span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Uma linha de seletores — um por dimensão de filtro, sem repetição
            de botões. "Personalizado" no período revela os dois campos de
            data logo abaixo, só quando fazem sentido. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            {DATE_PRESET_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            {STATUS_FILTER_OPTIONS.map(([value, label]) => (
              <option key={value || 'todos'} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Todos os produtos</option>
            {(productsQuery.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Todos os vendedores</option>
            {(sellersQuery.data ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Todos os clientes</option>
            {(customersQuery.data ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">
              De
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="ml-1.5 h-8 rounded-md border border-border bg-background px-2 text-xs"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Até
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="ml-1.5 h-8 rounded-md border border-border bg-background px-2 text-xs"
              />
            </label>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Os filtros acima afetam os KPIs de pedidos e vendas abaixo. Os totais de catálogo (Produtos, Simulações) mostram sempre o total geral.
        </p>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard title="Total de Produtos" value={totalProducts}
          subtitle={totalProducts === 0 ? 'Nenhum produto ainda' : undefined}
          icon={Package} accent="bg-blue-500" href="/produtos" />
        <KpiCard title="Produtos Ativos" value={activeProducts}
          subtitle={activeProducts === 0 ? 'Nenhum ativo' : `${totalProducts - activeProducts} inativos`}
          icon={CheckCircle2} accent="bg-emerald-500" href="/produtos" />
        <KpiCard title="Simulações" value={totalSims}
          subtitle={totalSims === 0 ? 'Nenhuma simulação' : `${healthyCount} saudáveis`}
          icon={Calculator} accent="bg-violet-500" href="/simulacoes" />
        <KpiCard title="Atenção" value={attentionCount}
          subtitle={attentionCount === 0 ? 'Tudo OK ✓' : 'Revisar preços'}
          icon={AlertTriangle} accent={attentionCount > 0 ? 'bg-amber-500' : 'bg-slate-400'} href="/simulacoes" />
        <KpiCard title="Lista de Desejos" value={wishlistNew}
          subtitle={wishlistNew === 0 ? 'Nenhum pedido' : `${wishlistContact} em contato`}
          icon={Heart} accent="bg-pink-500" href="/desejos-admin" />
      </div>

      {/* ── KPIs de Pedidos/Vendas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Aguardando Pagamento" value={ordersAguardando}
          subtitle={ordersAguardando === 0 ? 'Nenhum pendente' : 'Confirmar no painel'}
          icon={Clock} accent="bg-blue-400" href="/pedidos" />
        <KpiCard title="Vendas Confirmadas" value={ordersPagos}
          subtitle={ordersPagos === 0 ? 'Nenhuma venda' : `${ordersPagos} pedido(s) pago(s)`}
          icon={ShoppingCart} accent="bg-green-500" href="/pedidos" />
        <KpiCard title="Faturamento Confirmado" value={fmtBrl(faturamento)}
          subtitle={faturamento === 0 ? 'Sem faturamento' : 'Apenas pedidos PAGO'}
          icon={DollarSign} accent="bg-emerald-600" href="/pedidos" />
        <KpiCard title="Ticket Médio" value={ticketMedio > 0 ? fmtBrl(ticketMedio) : '—'}
          subtitle={ticketMedio === 0 ? 'Nenhuma venda' : 'Valor médio por venda'}
          icon={TrendingUp} accent="bg-violet-400" href="/pedidos" />
      </div>

      {/* ── Linha 2: Saúde + Simulações ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Saúde do catálogo */}
        <Section title="Saúde do Catálogo" icon={BarChart3}>
          {totalProducts === 0 ? (
            <EmptyState icon={ShoppingBag} text="Cadastre produtos para ver os indicadores de saúde do catálogo." />
          ) : (
            <div className="space-y-4">
              <MiniBar label="Publicados" value={activeProducts} max={totalProducts} color="bg-emerald-500" />
              <MiniBar label="Simulações saudáveis" value={healthyCount} max={simTotal} color="bg-blue-500" />
              <MiniBar label="Requerem atenção" value={attentionCount} max={simTotal} color="bg-amber-500" />
              <div className="space-y-2 pt-2">
                <AlertRow icon={CheckCircle2} label="Produtos ativos" value={activeProducts} severity={activeProducts > 0 ? 'ok' : 'warn'} />
                {attentionCount > 0 && (
                  <AlertRow icon={AlertTriangle} label="Precisam de revisão" value={attentionCount} severity="warn" />
                )}
                {totalProducts > 0 && totalSims === 0 && (
                  <AlertRow icon={Calculator} label="Sem simulação" value="Calcule preços" severity="warn" />
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Simulações Recentes */}
        <div className="lg:col-span-2">
          <Section title="Simulações Recentes" icon={TrendingUp}
            action={
              <Link href="/simulacoes">
                <span className="text-xs text-primary font-medium hover:underline cursor-pointer">Ver todas →</span>
              </Link>
            }
          >
            {recentSims.length === 0 ? (
              <EmptyState icon={Calculator} text="Ainda não há simulações registradas. Use o simulador para calcular preços." />
            ) : (
              <div className="divide-y divide-border -my-1">
                {recentSims.map((s: any) => {
                  const diag = s.diagnosis ?? 'PENDENTE';
                  return (
                    <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        {s.createdAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {diag !== 'PENDENTE' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diagColors[diag] ?? diagColors.PENDENTE}`}>
                            {diag}
                          </span>
                        )}
                        <Link href={`/simulacoes/${s.id}`}>
                          <span className="text-xs text-primary font-medium hover:underline cursor-pointer whitespace-nowrap">
                            Ver detalhes →
                          </span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Ações Rápidas ─────────────────────────────────────────────── */}
      <Section title="Ações Rápidas" icon={Zap}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Novo Produto',  icon: Package,    href: '/produtos/novo',   desc: 'Cadastrar produto',  external: false },
            { label: 'Simulador',     icon: Calculator, href: '/simulacoes/nova', desc: 'Calcular preços',    external: false },
            { label: 'Ver Produtos',  icon: Boxes,      href: '/produtos',         desc: 'Gerenciar catálogo', external: false },
            { label: 'Ver Vitrine',   icon: Store,      href: '/vitrine',          desc: 'Vitrine pública',    external: true  },
          ].map(({ label, icon: Icon, href, desc, external }) => {
            const inner = (
              <div className="flex flex-col items-center justify-center text-center gap-2 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            );
            return external
              ? <a key={label} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <Link key={label} href={href}>{inner}</Link>;
          })}
        </div>
      </Section>

      {/* ── Onboarding vazio ──────────────────────────────────────────── */}
      {totalProducts === 0 && totalSims === 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Bem-vindo ao PermuPay!</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Seu painel ainda está vazio. Comece cadastrando produtos, simulando preços e publicando na sua vitrine.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/produtos/novo">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Package className="w-4 h-4" /> Cadastrar Primeiro Produto
              </button>
            </Link>
            <Link href="/simulacoes/nova">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-accent transition-colors">
                <Calculator className="w-4 h-4" /> Simular Preços
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
