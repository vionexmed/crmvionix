## Problema
Os links abaixo dos campos Client ID / Client Secret / Refresh Token na configuração do Gmail estão abrindo páginas inválidas (provavelmente 404 ou redirecionamento para o seletor de projeto sem contexto).

## Correção proposta em `src/pages/Integrations.tsx`

Trocar as URLs dos três campos OAuth por endereços oficiais e estáveis:

- **Client ID** e **Client Secret** → `https://console.cloud.google.com/apis/credentials/oauthclient`  
  (página direta de criação de OAuth Client; força login/seleção de projeto se necessário)
  
- **Refresh Token** → `https://developers.google.com/oauthplayground/`  
  (com a barra final, que é a URL canônica do Playground)

Adicionalmente:
- Adicionar um 4º campo de ajuda apontando para a habilitação da Gmail API:  
  `https://console.cloud.google.com/apis/library/gmail.googleapis.com`  
  exibido como nota no topo do diálogo (acima dos campos), já que sem habilitar a API o Client ID não funciona.

## Detalhes técnicos
- Apenas alteração de strings `helpUrl` no array `integrations[0].fields`.
- Inserir um pequeno bloco `<p>` informativo no `DialogContent` do diálogo de configuração, renderizado apenas quando `editProvider === "gmail"`.
- Sem mudanças em edge functions ou lógica de negócio.
