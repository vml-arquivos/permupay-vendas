import { Link } from 'wouter';import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Package, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { data, isLoading, error } = trpc.dashboard.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Erro ao carregar dashboard</h2>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: 'Total de Produtos', value: data.totalProducts, icon: Package, color: 'text-blue-500' },
    { label: 'Produtos Ativos', value: data.activeProducts, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Simulações Realizadas', value: data.totalSimulations, icon: Calculator, color: 'text-purple-500' },
    { label: 'Atenção Necessária', value: data.attentionCount, icon: AlertTriangle, color: 'text-amber-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentSimulations.length > 0 ? (
              data.recentSimulations.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                  <div className="font-medium">{s.name}</div>
                  <Link href={`/simulacoes/${s.id}`} className="text-sm text-primary hover:underline">
                    Ver detalhes
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Nenhuma simulação encontrada.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
