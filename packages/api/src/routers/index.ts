import { analyzeSkillInputSchema, analyzeSkillSource } from "../skill-flow";
import { protectedProcedure, publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  analyzeSkill: publicProcedure.input(analyzeSkillInputSchema).mutation(async ({ input }) => {
    return analyzeSkillSource(input);
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
