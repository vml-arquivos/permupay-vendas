/**
 * server/_core/trpc.ts
 *
 * ALTERAÇÃO DE SEGURANÇA (conforme requisito de negócio):
 * - Removida a distinção de roles (admin/user/manager)
 * - Qualquer usuário autenticado tem acesso total (equivalente a admin)
 * - adminProcedure agora é idêntico a protectedProcedure
 * - Verificações de ctx.user.role !== "admin" foram removidas do routers.ts
 */

import { UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const FRIENDLY_ERROR_MESSAGE =
  "Não foi possível processar sua solicitação agora. Tente novamente.";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    if (shape.data.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: FRIENDLY_ERROR_MESSAGE };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Qualquer usuário autenticado → acesso total
const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

// adminProcedure agora é igual a protectedProcedure —
// qualquer usuário logado tem privilégios de administrador
export const adminProcedure = protectedProcedure;
