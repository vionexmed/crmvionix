import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  CheckSquare,
  AlertTriangle,
  Inbox,
  FileText,
  Zap,
  Target,
  Plug,
  Shield,
  Handshake,
  MessageSquare,
} from "lucide-react";
import vionexLogo from "@/assets/vionex-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { AtRiskPanel } from "@/components/crm/AtRiskPanel";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";

const generalItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contatos", url: "/contacts", icon: Users },
  { title: "Empresas", url: "/companies", icon: Building2 },
  { title: "Negócios", url: "/deals", icon: Handshake },
  { title: "Atividades", url: "/activities", icon: Activity },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
];

const conversationItems = [
  { title: "Conversas", url: "/conversations", icon: MessageSquare },
];

const emailItems = [
  { title: "Caixa de Entrada", url: "/inbox", icon: Inbox },
  { title: "Templates", url: "/email-templates", icon: FileText },
  { title: "Sequências", url: "/email-sequences", icon: Zap },
];

const analyticsItems = [
  { title: "Metas", url: "/sales-goals", icon: Target },
  { title: "Lead Scoring", url: "/lead-scoring", icon: Target },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Automações", url: "/automations", icon: Zap },
];

const marketingItems = [
  { title: "Visão Geral", url: "/marketing/visao-geral", icon: LayoutDashboard },
];

const adminItems = [
  { title: "Equipe", url: "/team", icon: Users },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Integrações", url: "/settings/integrations", icon: Plug },
  { title: "Segurança", url: "/settings/security", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { orgId } = useOrg();

  const [atRiskOpen, setAtRiskOpen] = useState(false);
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "lead") as any;
      setLeadCount(count || 0);
    };
    fetchCount();
    const channel = supabase.channel("leads-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `org_id=eq.${orgId}` }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId]);
  

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const renderNavGroup = (items: typeof generalItems, label?: string) => (
    <SidebarGroup>
      <SidebarGroupContent>
        {label && !collapsed && (
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        )}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-accent/50" activeClassName="bg-accent text-accent-foreground font-medium">
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-border">
        <SidebarHeader className="p-3">
          <div className="flex items-center justify-center">
            <img src={vionexLogo} alt="VIONEX" className={collapsed ? "h-10 w-10 object-contain" : "h-24 w-24 object-contain"} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          {/* Geral */}
          <SidebarGroup>
            <SidebarGroupContent>
              {!collapsed && (
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Geral
                </p>
              )}
              <SidebarMenu>
                {generalItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-accent/50" activeClassName="bg-accent text-accent-foreground font-medium">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Leads com badge */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/leads")} tooltip="Leads">
                    <NavLink to="/leads" className="hover:bg-accent/50 flex items-center justify-between" activeClassName="bg-accent text-accent-foreground font-medium">
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {!collapsed && <span>Leads</span>}
                      </span>
                      {leadCount > 0 && !collapsed && (
                        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                          {leadCount > 99 ? "99+" : leadCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Em Risco" onClick={() => setAtRiskOpen(true)} className="hover:bg-accent/50 cursor-pointer">
                    <AlertTriangle className="h-4 w-4" />{!collapsed && <span>Em Risco</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {renderNavGroup(conversationItems, "Atendimento")}
          {renderNavGroup(emailItems, "Email")}
          {renderNavGroup(marketingItems, "Marketing")}
          {renderNavGroup(analyticsItems, "Analytics")}
          {renderNavGroup(adminItems, "Admin")}
        </SidebarContent>
        <SidebarFooter className="border-t border-border p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">{profile?.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">{profile?.name || "Usuário"}</span>
                <span className="truncate text-xs text-muted-foreground">{profile?.email}</span>
              </div>
            )}
            {!collapsed && (
              <button onClick={signOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
      
      <AtRiskPanel open={atRiskOpen} onOpenChange={setAtRiskOpen} />
    </>
  );
}
