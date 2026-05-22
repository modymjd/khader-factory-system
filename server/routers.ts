import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./auth-routers";
import { dashboardRouter } from "./routers/dashboard";
import { usersRouter } from "./routers/users";
import { productsRouter } from "./routers/products";
import { ordersRouter } from "./routers/orders";
import { attendanceRouter } from "./routers/attendance";
import { analyticsRouter } from "./routers/analytics";
import { rolesRouter } from "./routers/roles";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  users: usersRouter,
  products: productsRouter,
  orders: ordersRouter,
  attendance: attendanceRouter,
  analytics: analyticsRouter,
  roles: rolesRouter,
});

export type AppRouter = typeof appRouter;
