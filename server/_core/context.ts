import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SafeUser } from "../../drizzle/schema";
import type { SafeCustomer } from "../../drizzle/schema.customers";
import { sdk } from "./sdk";
import { customerSdk } from "./customerAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
  // Sessão do cliente final (loja/minha conta) — completamente separada da
  // sessão interna (`user` acima, admin/vendedor). Populada a partir de um
  // cookie diferente (CUSTOMER_COOKIE_NAME); nula quando o cliente não está
  // logado, o que é normal para a maior parte das rotas públicas.
  customer: SafeCustomer | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: SafeUser | null = null;
  let customer: SafeCustomer | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  try {
    customer = await customerSdk.authenticateRequest(opts.req);
  } catch (error) {
    // Sessão de cliente também é opcional — a maior parte das rotas
    // públicas funciona sem ela; customerProcedure exige que exista.
    customer = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    customer,
  };
}
