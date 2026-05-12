

## Revisão Completa do Fluxo de Onboarding (Remix-safe)

Auditoria do fluxo atual identificou **6 pontos frágeis** que podem quebrar quando o projeto for remixado. Plano consolida todas as correções num único hardening.

### Pontos frágeis identificados

| # | Onde | Risco em remix |
|---|---|---|
| 1 | `handle_new_user()` | Se a primeira org já existir (caso comum em remix de DB clonado), novos usuários entram como `member` sem org própria — impede `create_organization_for_user` |
| 2 | Trigger `on_auth_user_created` | Não está garantido no migration consolidado; remix sem trigger = profile órfão permanente |
| 3 | `AuthContext.loadProfile` | 3 retries em 1.1s podem ser insuficientes se trigger demorar; sem refetch reativo |
| 4 | `OnboardingModal` useEffect | `initializedRef` não reseta entre logins (logout + novo login no mesmo tab quebra) |
| 5 | `CompanyStep` | Usa `.single()` (lança erro se org sumir); marca configurado só por `segment` mas não normaliza |
| 6 | `Login.tsx` setTimeout 400ms | Race condition residual: navega antes do profile estar pronto se trigger demorar >400ms |

### Plano de correção

#### 1. Migration: garantir trigger e função idempotentes

```sql
-- Recriar função handle_new_user com semântica forte para remix
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
-- Lógica: profile SEMPRE com onboarding_completed=false, onboarding_step=1
-- Org: sempre criar nova org para o primeiro usuário; demais entram como member na org existente

-- Recriar trigger idempotente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill defensivo: qualquer auth.user sem profile recebe um agora
INSERT INTO public.profiles (id, email, name, onboarding_completed, onboarding_step)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), false, 1
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

#### 2. `src/contexts/AuthContext.tsx`

- Aumentar retries para **5 tentativas** com backoff `[0, 200, 500, 1000, 1500]ms` (cobre triggers lentos pós-remix)
- Adicionar `refreshProfile()` automático quando `loadProfile` retorna `null` após todos retries (último recurso: tentar reparar via insert direto se `auth.uid()` válido)
- Resetar estado completamente em `signOut` (já existe) — adicionar reset do `loading` para `true` num novo `getSession`

#### 3. `src/components/onboarding/OnboardingModal.tsx`

- **Remover `initializedRef`**. Trocar por lógica idempotente baseada apenas em `profile.onboarding_completed`:
  - Se `user && profile && !profile.onboarding_completed` → modal aberto
  - Se `profile.onboarding_completed` → modal fechado
  - Reage a mudanças de `profile` (novo login, refresh)
- Carregar persistência (`loadPersistedOnboardingState`) apenas **uma vez por user.id** via ref que reseta quando user muda

#### 4. `src/components/onboarding/CompanyStep.tsx`

- Trocar `.single()` por `.maybeSingle()` (remix com org deletada não quebra a tela)
- Manter regra: só marcar `alreadyConfigured` se `settings.segment` existir

#### 5. `src/pages/Login.tsx`

- Remover `setTimeout(400ms)` arbitrário. Em vez disso: após `signUp` bem-sucedido, **não navegar** — deixar o `useEffect([user])` existente fazer o redirect quando `user` for setado pelo `AuthContext` (que já tem retry resiliente)
- Garantir que `useEffect` só navega se `user` existir (já está correto)

#### 6. Verificação automática pós-remix

Após aplicar, executar e validar:
- Trigger `on_auth_user_created` existe em `auth.users` ✓
- Função `handle_new_user` existe e tem `SECURITY DEFINER` ✓
- Nenhum `auth.users` sem profile correspondente ✓
- `felippe@fretebarato.com` (atualmente `onboarding_completed=false, step=1`) ao logar verá o modal automaticamente ✓

### Resumo de alterações

| Arquivo | Tipo |
|---|---|
| Migration SQL | Recriar `handle_new_user` + trigger + backfill |
| `src/contexts/AuthContext.tsx` | 5 retries com backoff maior |
| `src/components/onboarding/OnboardingModal.tsx` | Remover `initializedRef`, lógica reativa pura |
| `src/components/onboarding/CompanyStep.tsx` | `.maybeSingle()` em vez de `.single()` |
| `src/pages/Login.tsx` | Remover `setTimeout`, confiar no `useEffect([user])` |

### Critério de validação

1. **Remix do projeto** → primeiro usuário criado vê o modal no `/dashboard` automaticamente
2. **Logout + signup novo no mesmo tab** → modal abre sem refresh
3. **Usuário existente com `onboarding_completed=false`** → modal abre ao logar
4. **Console limpo** — sem warnings `profile still null after retries`

