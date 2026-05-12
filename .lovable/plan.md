
# Rebrand para VIONEX

Aplicar identidade visual da VIONEX (logo + paleta) em todo o sistema.

## Paleta oficial

| Token | Hex | HSL | Uso |
|---|---|---|---|
| Navy Profundo | #0A1E3D | 217 72% 14% | Sidebar (tema claro), foreground escuro, dark bg |
| Teal Institucional | #007B8A | 186 100% 27% | Primary (tema claro), botões, links, ring |
| Teal Claro | #00A3B5 | 187 100% 35% | Primary (tema escuro), hover, accent secundário |
| Branco | #FFFFFF | 0 0% 100% | Background claro, primary-foreground |
| Grafite | #3A3F47 | 218 10% 25% | Texto secundário, muted-foreground |

## Mudanças

### 1. Logo e nome
- Copiar `user-uploads://05_vionex.png` → `src/assets/vionex-logo.png`
- Substituir o ícone `Handshake` + texto "FlowCRM" no `AppSidebar.tsx` pelo logo importado
- Atualizar `index.html` (`<title>`, meta description, favicon → logo VIONEX)
- Buscar referências textuais a "FlowCRM" no projeto (Login, Setup, OnboardingModal, README) e trocar por "VIONEX"

### 2. Tokens de cor — `src/index.css`
Tema claro (`:root`):
- `--background`: branco puro `0 0% 100%`
- `--foreground` / `--card-foreground`: navy `217 72% 14%`
- `--primary`: teal institucional `186 100% 27%` / `--primary-foreground` `0 0% 100%`
- `--ring`: teal institucional
- `--muted-foreground`: grafite `218 10% 25%`
- Sidebar: `--sidebar-background` navy `217 72% 14%`, foreground branco, primary teal claro, accent navy mais claro

Tema escuro (`.dark`):
- `--background`: navy profundo `217 72% 14%`
- `--card`: navy ligeiramente mais claro
- `--primary`: teal claro `187 100% 35%`
- Sidebar: navy mais escuro, primary teal claro

### 3. Accent color padrão — `src/contexts/ThemeContext.tsx`
- Adicionar/substituir entrada `teal` em `ACCENT_COLORS` com:
  - light: `186 100% 27%` (Teal Institucional)
  - dark: `187 100% 35%` (Teal Claro)
  - ring: `186 100% 27%`
- Mudar default do `accentColor` de `"blue"` para `"teal"`
- Atualizar lista de cores selecionáveis em Settings (manter outras como opção)

### 4. Favicon e manifesto
- Gerar/copiar versão pequena do logo para `public/favicon.ico` (ou usar `.png`)
- Atualizar `<link rel="icon">` em `index.html`

## Não faz parte
- Não alterar lógica de negócio, RLS, edge functions ou rotas
- Não mexer em `client.ts`/`types.ts`
- Memórias do projeto (Attio/Linear inspiração, Inter font, light default) permanecem

Posso prosseguir?
