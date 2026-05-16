import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Database, Globe, Shield, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Configuracoes() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Configurações gerais do sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                Domínio Principal
              </CardTitle>
              <CardDescription>URL de acesso ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <code className="text-sm bg-muted px-2 py-1 rounded">autopay.permupay.com.br</code>
                <Badge variant="secondary" className="bg-green-100 text-green-700">Ativo</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Banco de Dados
              </CardTitle>
              <CardDescription>Status da conexão</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">PostgreSQL 17</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">Conectado</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Segurança
              </CardTitle>
              <CardDescription>Configurações de autenticação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Sessão com JWT</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>HTTPS</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">Ativo</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Vitrine Pública
              </CardTitle>
              <CardDescription>Marketplace acessível sem login</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <code className="text-sm bg-muted px-2 py-1 rounded">/vitrine</code>
                <Badge variant="secondary" className="bg-green-100 text-green-700">Pública</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
