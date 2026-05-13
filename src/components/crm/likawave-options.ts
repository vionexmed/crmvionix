// Opções dos campos do formulário Likawave (espelha o Google Forms).
export const ESPECIALIDADE_OPTIONS = [
  "Ortopedia",
  "Medicina Esportiva",
  "Fisiatria",
  "Fisioterapia",
  "Medicina Regenerativa",
  "Cirurgia da Coluna",
] as const;

export const LOCAL_ATUACAO_OPTIONS = [
  "Clínica própria",
  "Hospital",
  "Centro de reabilitação",
  "Day Hospital",
  "Consultório compartilhado",
] as const;

export const EQUIPAMENTO_OPTIONS = ["BTL", "Storz", "EMS"] as const;

export const NIVEL_INTERESSE_OPTIONS = [
  "Quero comprar um equipamento",
  "Quero avaliar uma demonstração",
  "Quero entender o modelo de negócio",
  "Interesse em parceria clínica",
] as const;

export const TRATAMENTOS_OPTIONS = [
  "Tendinopatias",
  "Fascite plantar",
  "Lesões musculares",
  "Medicina regenerativa",
  "Tratamento de feridas",
  "Dor crônica",
  "Disfunções musculoesqueléticas",
] as const;

export const PACIENTES_MES_OPTIONS = ["Até 10", "10 – 30", "30 – 60", "Mais de 60"] as const;

export const AGENDAMENTO_OPTIONS = [
  "Demonstração na minha clínica",
  "Demonstração online",
  "Receber proposta comercial",
  "Receber material científico",
] as const;

export const AUTORIZACAO_OPTIONS = [
  "AUTORIZO o contato da equipe para envio de informações científicas, comerciais e demonstrações do equipamento Likawave.",
  "NÃO AUTORIZO o contato da equipe para envio de informações científicas, comerciais e demonstrações do equipamento Likawave.",
] as const;

export const CLASSIFICACAO_LEAD_OPTIONS = [
  "Lead quente – compra imediata",
  "Lead médio – avaliação",
  "Lead frio – interesse futuro",
] as const;

export type LikawaveMetadata = {
  instagram?: string;
  cidade_estado?: string;
  especialidade_medica?: string;
  especialidade_outro?: string;
  crm_crefito?: string;
  local_atuacao?: string;
  local_atuacao_outro?: string;
  usa_ondas_choque?: "Sim" | "Não" | "";
  equipamento_atual?: string;
  equipamento_outro?: string;
  nivel_interesse?: string;
  nivel_interesse_outro?: string;
  tratamentos_pretendidos?: string[];
  tratamentos_outro?: string;
  pacientes_mes?: string;
  agendamento_demo?: string[];
  agendamento_outro?: string;
  autorizacao_contato?: string;
  classificacao_lead?: string;
  responsavel_cadastro?: string;
};
