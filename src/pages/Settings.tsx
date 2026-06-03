import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail } from "lucide-react";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { PipelinesTab } from "@/components/settings/PipelinesTab";
import { CustomFieldsTab } from "@/components/settings/CustomFieldsTab";
import { EmailSignatureTab } from "@/components/settings/EmailSignatureTab";
import { MembersTab } from "@/components/settings/MembersTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { BillingTab } from "@/components/settings/BillingTab";

export default function Settings() {
  const { user, profile } = useAuth();
  const { orgId } = useOrg();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil, organização e preferências</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="custom-fields">Campos</TabsTrigger>
          <TabsTrigger value="email-signature"><Mail className="h-3 w-3 mr-1" />Assinatura</TabsTrigger>
          <TabsTrigger value="members" onClick={() => window.location.href = '/team'}>Membros</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="billing">Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab orgId={orgId} userId={user?.id} profile={profile} />
        </TabsContent>
        <TabsContent value="pipelines" className="mt-4">
          <PipelinesTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="custom-fields" className="mt-4">
          <CustomFieldsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="email-signature" className="mt-4">
          <EmailSignatureTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <MembersTab orgId={orgId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab orgId={orgId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillingTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
