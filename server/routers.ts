import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { authRouter } from "./auth-routers";
import { usersRouter } from "./routers/users";
import { rolesRouter } from "./routers/roles";
import { productsRouter } from "./routers/products";
import { ordersRouter } from "./routers/orders";
import { attendanceRouter } from "./routers/attendance";
import { analyticsRouter } from "./routers/analytics";
import { dashboardRouter } from "./routers/dashboard";
import { salaryRouter } from "./routers/salary";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  roles: rolesRouter,
  products: productsRouter,
  orders: ordersRouter,
  attendance: attendanceRouter,
  analytics: analyticsRouter,
  dashboard: dashboardRouter,
  salary: salaryRouter,
});

export type AppRouter = typeof appRouter;
