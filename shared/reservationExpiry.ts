/**
 * client/src/lib/reservationExpiry.ts
 *
 * Toda reserva (pedido AGUARDANDO_PAGAMENTO/RESERVADO) já tem uma data de
 * expiração real (`expiresAt`, gravada no pedido no momento da criação —
 * ver server/db.orders.ts). O que faltava era deixar isso visível para o
 * cliente. Estes helpers formatam o tempo restante a partir do valor real do
 * pedido — nunca um texto fixo — para nunca informar um prazo que não bate
 * com o que o sistema realmente pratica.
 */

export function isExpired(expiresAt?: string | Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export function formatTimeRemaining(expiresAt?: string | Date | null): string {
  if (!expiresAt) return "";
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expirada";

  const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `Expira em ${hours}h ${minutes}min` : `Expira em ${hours}h`;
  }
  return `Expira em ${minutes}min`;
}
