/**
 * Opções compartilhadas dos formulários de contato.
 * Fonte única: antes o modal de criação e o drawer de edição tinham listas
 * DIFERENTES — editar um contato com especialidade ausente na lista do
 * drawer renderizava um Select vazio.
 */
export const AREAS_ATUACAO = [
  "Acupuntura", "Alergia e Imunologia", "Anestesiologia", "Angiologia",
  "Cardiologia", "Cirurgia Cardiovascular", "Cirurgia da Mão",
  "Cirurgia de Cabeça e Pescoço", "Cirurgia do Aparelho Digestivo",
  "Cirurgia Geral", "Cirurgia Oncológica", "Cirurgia Pediátrica",
  "Cirurgia Plástica", "Cirurgia Torácica", "Cirurgia Vascular",
  "Clínica Médica", "Coloproctologia", "Dermatologia",
  "Endocrinologia e Metabologia", "Endoscopia", "Fisiatra",
  "Fisioterapia", "Gastroenterologia", "Genética Médica",
  "Geriatria", "Ginecologia e Obstetrícia", "Hematologia e Hemoterapia",
  "Homeopatia", "Infectologia", "Mastologia",
  "Medicina de Emergência", "Medicina de Família e Comunidade",
  "Medicina do Esporte", "Medicina do Trabalho",
  "Medicina Intensiva", "Medicina Legal", "Medicina Nuclear",
  "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia",
  "Neurologia", "Nutrologia", "Nutrição",
  "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia",
  "Otorrinolaringologia", "Patologia", "Pediatria",
  "Pneumologia", "Psiquiatria", "Psicologia",
  "Radiologia e Diagnóstico por Imagem", "Radioterapia", "Reumatologia",
  "Urologia", "Outro",
];

export const PAISES = [
  "Brasil", "Portugal", "Estados Unidos", "Argentina", "Colômbia",
  "México", "Chile", "Uruguai", "Paraguai", "Peru", "Outro",
];
