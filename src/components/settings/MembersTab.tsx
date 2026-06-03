import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, UserPlus, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function MembersTab({ orgId, userId }: { orgId: string | null; userId?: string }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<(Profile & { role?: string })[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  // Teams
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    const [{ data: profs }, { data: rl }, { data: tms }, { data: tmem }] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", orgId),
      supabase.from("user_roles").select("*").eq("org_id", orgId),
      supabase.from("teams").select("*").eq("org_id", orgId) as any,
      supabase.from("team_members").select("*") as any,
    ]);
    setRoles(rl || []);
    setTeams(tms || []);
    setTeamMembers(tmem || []);
    const merged = (profs || []).map((p) => {
      const r = (rl || []).find((r: any) => r.user_id === p.id);
      return { ...p, role: r?.role || "member" };
    });
    setMembers(merged);
  }, [orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sendInvite = async () => {
    if (!orgId || !inviteEmail) return;
    const { error } = await supabase.from("invitations").insert({
      org_id: orgId, email: inviteEmail, invited_by: userId, role: inviteRole as any,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setInviteEmail("");
    toast({ title: "Convite enviado!" });
  };

  const removeUser = async (uid: string) => {
    if (uid === userId) { toast({ title: "Você não pode remover a si mesmo", variant: "destructive" }); return; }
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("org_id", orgId!);
    await supabase.from("profiles").update({ org_id: null }).eq("id", uid);
    fetchAll();
    toast({ title: "Acesso revogado" });
  };

  const createTeam = async () => {
    if (!orgId || !newTeamName) return;
    await supabase.from("teams").insert({ org_id: orgId, name: newTeamName } as any);
    setNewTeamName("");
    fetchAll();
    toast({ title: "Equipe criada" });
  };

  const deleteTeam = async (id: string) => {
    await supabase.from("teams").delete().eq("id", id);
    fetchAll();
    toast({ title: "Equipe excluída" });
  };

  const toggleTeamMember = async (teamId: string, uid: string) => {
    const exists = teamMembers.find((tm: any) => tm.team_id === teamId && tm.user_id === uid);
    if (exists) {
      await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", uid);
    } else {
      await supabase.from("team_members").insert({ team_id: teamId, user_id: uid } as any);
    }
    fetchAll();
  };

  const roleLabels: Record<string, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro" };
  const roleColors: Record<string, string> = { owner: "text-warning", admin: "text-primary", member: "text-muted-foreground" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Convidar Membro</CardTitle>
          <CardDescription className="text-[10px]">Envie convites por email com papel definido</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-8 text-xs flex-1" />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs" onClick={sendInvite}><UserPlus className="mr-1 h-3 w-3" />Convidar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Membros ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {m.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.email} · {m.title || "—"}</p>
                </div>
                <Badge variant="outline" className={`text-[8px] ${roleColors[m.role || "member"]}`}>
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  {roleLabels[m.role || "member"]}
                </Badge>
                {m.id !== userId && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeUser(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Equipes</CardTitle>
              <CardDescription className="text-[10px]">Organize vendedores em grupos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome da equipe" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="h-8 text-xs flex-1" />
            <Button size="sm" className="h-8 text-xs" onClick={createTeam}><Plus className="mr-1 h-3 w-3" />Criar</Button>
          </div>
          {teams.map((t: any) => (
            <div key={t.id} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1.5"><Users className="h-3 w-3" />{t.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTeam(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const inTeam = teamMembers.some((tm: any) => tm.team_id === t.id && tm.user_id === m.id);
                  return (
                    <button key={m.id} onClick={() => toggleTeamMember(t.id, m.id)}
                      className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${inTeam ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                      {m.name || m.email}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RBAC Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5"><Shield className="h-4 w-4" />Permissões (RBAC)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Permissão</TableHead>
                <TableHead className="text-[10px] text-center">Owner</TableHead>
                <TableHead className="text-[10px] text-center">Admin</TableHead>
                <TableHead className="text-[10px] text-center">Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Ver todos os dados", true, true, false],
                ["Editar qualquer registro", true, true, false],
                ["Gerenciar usuários/config", true, true, false],
                ["Criar automações", true, true, false],
                ["Exportar dados", true, true, false],
                ["Ver relatórios", true, true, false],
                ["Billing / deletar org", true, false, false],
                ["Ver/editar próprios registros", true, true, true],
              ].map(([perm, o, a, m], i) => (
                <TableRow key={i}>
                  <TableCell className="text-[10px]">{perm as string}</TableCell>
                  <TableCell className="text-center text-xs">{o ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-center text-xs">{a ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-center text-xs">{m ? "✅" : "❌"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
