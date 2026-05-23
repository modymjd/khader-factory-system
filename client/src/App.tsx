import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Attendance from "./pages/Attendance";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import Roles from "./pages/Roles";
import Salary from "./pages/Salary";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      <Route path="/dashboard">
        <DashboardLayout>
          <ProtectedRoute requiredResource="dashboard" requiredAction="view">
            <Dashboard />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/users">
        <DashboardLayout>
          <ProtectedRoute requiredResource="users" requiredAction="view">
            <Users />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/products">
        <DashboardLayout>
          <ProtectedRoute requiredResource="products" requiredAction="view">
            <Products />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/orders">
        <DashboardLayout>
          <ProtectedRoute requiredResource="orders" requiredAction="view">
            <Orders />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/attendance">
        <DashboardLayout>
          <ProtectedRoute requiredResource="attendance" requiredAction="view">
            <Attendance />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/sales">
        <DashboardLayout>
          <ProtectedRoute requiredResource="analytics" requiredAction="view">
            <Analytics />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/auditlogs">
        <DashboardLayout>
          <ProtectedRoute requiredResource="audit_logs" requiredAction="view">
            <AuditLogs />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/roles">
        <DashboardLayout>
          <ProtectedRoute requiredResource="roles" requiredAction="view">
            <Roles />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route>
        <Redirect to="/dashboard" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
