import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function Marketing() {
  const loc = useLocation();
  if (loc.pathname === "/marketing" || loc.pathname === "/marketing/") {
    return <Navigate to="/marketing/visao-geral" replace />;
  }
  return <Outlet />;
}
