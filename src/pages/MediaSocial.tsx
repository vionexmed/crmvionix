import { ExternalLink, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";

const CARROSSEL_URL = "https://carousel-magic-spark-16.lovable.app";

export default function MediaSocial() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Conteúdo"
        title="Mídia Rede Social"
        description="Acesse o gerador de carrosséis e veja abaixo os carrosséis salvos no projeto."
        icon={Images}
        pattern="sparkle"
        actions={
          <Button asChild>
            <a href={CARROSSEL_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir Carrossel
            </a>
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-sm font-medium">Gerações salvas — Carrossel</p>
          <a
            href={CARROSSEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Abrir em nova aba <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <iframe
          src={CARROSSEL_URL}
          title="Carrossel - Mídia Rede Social"
          className="w-full h-[75vh] bg-background"
        />
      </div>
    </div>
  );
}
