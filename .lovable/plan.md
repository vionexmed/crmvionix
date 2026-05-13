## Objetivo

Substituir o formulário de criação/edição de **Contatos** para refletir exatamente os campos do Google Forms "CADASTRO LIKAWAVE", e padronizar o telefone no formato **+DDI DDD NÚMERO** (ex.: `+55 81 99999-0000`).

## Campos do novo formulário (na ordem do Forms)

1. **Nome completo** (texto, obrigatório)
2. **Email** (email)
3. **Telefone** (com máscara DDI+DDD+número, validação)
4. **Instagram Profissional** (opcional)
5. **Cidade/Estado** (texto)
6. **Especialidade Médica** (select + "Outro"): Ortopedia, Medicina Esportiva, Fisiatria, Fisioterapia, Medicina Regenerativa, Cirurgia da Coluna
7. **CRM / CREFITO** (texto)
8. **Local de Atuação** (select + "Outro"): Clínica própria, Hospital, Centro de reabilitação, Day Hospital, Consultório compartilhado
9. **Já utiliza Ondas de Choque?** (Sim/Não)
10. **Qual equipamento?** (select + "Outro"): BTL, Storz, EMS
11. **Nível de interesse Likawave** (select + "Outro"): Comprar equipamento, Avaliar demonstração, Entender modelo de negócio, Parceria clínica
12. **Tratamentos pretendidos** (multi-select + "Outro"): Tendinopatias, Fascite plantar, Lesões musculares, Medicina regenerativa, Tratamento de feridas, Dor crônica, Disfunções musculoesqueléticas
13. **Pacientes/mês com indicação** (select): Até 10, 10–30, 30–60, Mais de 60
14. **Agendamento de demonstração** (multi-select + "Outro"): Demonstração na clínica, Demonstração online, Receber proposta comercial, Receber material científico
15. **Autorização** (radio): AUTORIZO / NÃO AUTORIZO contato
16. **Classificação do Lead** (uso interno, radio): Quente – compra imediata, Médio – avaliação, Frio – interesse futuro
17. **Responsável pelo cadastro** (texto, default = usuário logado)

## Telefone — formato DDI+DDD+número

- Máscara visual: `+55 (81) 99999-0000`
- Armazenamento: E.164 (`+5581999990000`)
- Validação com `libphonenumber-js` (já leve, ~30kb) ou regex `^\+\d{1,3}\s?\d{2,3}\s?\d{4,5}-?\d{4}$`
- Bloqueio de submissão se inválido, mensagem "Telefone deve incluir DDI + DDD + número"

## Onde aplicar

- `src/components/crm/ContactCreateModal.tsx` — substituir formulário inteiro
- `src/components/crm/ContactDrawer.tsx` — espelhar os mesmos campos na edição
- `src/components/setup/StepContacts.tsx` — manter simples (apenas nome+email+telefone com a nova máscara)

## Persistência

A tabela `contacts` já tem `first_name`, `last_name`, `email`, `phone`, `title`, `linkedin_url`, `status`. Os campos novos serão salvos como **Custom Fields** (sistema já existente no projeto, ver memória `custom-field-system`), pré-criados via migration:

- `especialidade_medica`, `crm_crefito`, `local_atuacao`, `usa_ondas_choque`, `equipamento_atual`, `nivel_interesse`, `tratamentos_pretendidos` (multi), `pacientes_mes`, `agendamento_demo` (multi), `autorizacao_contato`, `classificacao_lead`, `responsavel_cadastro`, `instagram`, `cidade_estado`

O `phone` continua na coluna existente em formato E.164. `Nome completo` será dividido em `first_name`/`last_name` no submit (split no primeiro espaço).

## Detalhes técnicos

- Adicionar dependência `libphonenumber-js` para validação/format.
- Criar componente `PhoneInput` reutilizável em `src/components/ui/phone-input.tsx`.
- Selects "Outro" usam pattern: ao escolher "Outro", aparece input livre abaixo.
- Multi-select usa `Checkbox` em lista (consistente com o restante do app).
- Migration: inserir custom_field_definitions para as 14 chaves acima, escopo `contact`.

## Fora de escopo

- Não alterar `companies`, `deals`, `activities`.
- Não criar página pública de captação (apenas o modal interno).
- Lógica de scoring/automação a partir dos novos campos fica para outra iteração.
