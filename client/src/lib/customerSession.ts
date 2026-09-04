/**
 * client/src/lib/customerSession.ts
 *
 * O sistema identifica o cliente pelo mesmo contato usado em qualquer compra
 * (WhatsApp ou e-mail) — não existe senha/sessão de servidor no lado do
 * cliente. Isso já funciona como um "login" (o mesmo contato sempre volta ao
 * mesmo cadastro, em qualquer canal — vitrine, loja de vendedor, Nova Venda),
 * mas antes o cliente precisava redigitar o contato toda vez que voltava ao
 * site. Este módulo só lembra localmente (no navegador do próprio cliente,
 * nunca em outro dispositivo) o último contato usado, para reconhecer quem
 * está voltando sem esconder nem substituir o fluxo por contato.
 */

const STORAGE_KEY = "permupay_customer_contact";

export function getRememberedContact(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberContact(contact: string): void {
  if (typeof window === "undefined") return;
  const value = contact.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage indisponível (modo privado, navegador embutido, etc.) —
    // não bloqueia o fluxo, só perde a conveniência de lembrar o contato.
  }
}

export function forgetRememberedContact(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem — silenciosamente ignorado.
  }
}
