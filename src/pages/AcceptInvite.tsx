import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, Handshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Página de aceite de convite. O convidado chega aqui autenticado pelo
 * magic link do convite (redirectTo do invite-member) e define nome + senha
 * antes de entrar no CRM. A org e o papel já foram atribuídos pelo trigger
 * handle_new_user a partir do convite.
 */
export default function AcceptInvite() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // O magic link autentica via hash; aguarda a sessão existir
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Sem sessão e sem token de convite no hash → volta pro login
        if (!window.location.hash.includes("access_token")) {
          navigate("/");
          return;
        }
        // Dá tempo do supabase-js processar o hash
        setTimeout(check, 400);
        return;
      }
      // Garante org + papel do convite (auto-cura caso o trigger não tenha
      // encontrado o convite na criação do usuário)
      try { await supabase.rpc("claim_pending_invitation"); } catch { /* migration ausente */ }
      const metaName = (session.user.user_metadata as Record<string, string> | null)?.full_name;
      if (metaName) setName(metaName);
      setChecking(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.updateUser({
        password,
        data: { full_name: name },
      });
      if (error) throw error;
      if (user) {
        await supabase.from("profiles").update({ name }).eq("id", user.id);
      }
      toast({ title: "Bem-vindo(a)!", description: "Sua conta está pronta." });
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Erro ao concluir cadastro",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Handshake className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Você foi convidado(a)!</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Concluir cadastro</CardTitle>
            <CardDescription>Defina seu nome e uma senha para acessar o CRM</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-name"
                    placeholder="Seu nome"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Entrar no CRM"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
