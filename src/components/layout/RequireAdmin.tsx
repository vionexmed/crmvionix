import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Rota-guarda: só owner/admin passam. Comercial (member) é
 * redirecionado para o dashboard. Usar como layout route:
 * <Route element={<RequireAdmin />}> ...rotas admin... </Route>
 */
export function RequireAdmin() {
  const { loading, isAdmin } = useAuth();
  if (loading) return null; // AppLayout já exibe spinner durante o carregamento
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
