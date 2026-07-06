/**
 * ============================================================================
 * PONTE: Google Forms "CADASTRO LIKAWAVE" → CRM Vionex (endpoint lead-capture)
 * ============================================================================
 *
 * O QUE FAZ: a cada resposta enviada no formulário, envia os dados para o CRM,
 * criando um Lead (com os campos médicos guardados de forma estruturada).
 * Roda junto com qualquer outra captação existente — não substitui nada.
 *
 * COMO INSTALAR (uma vez, ~5 min):
 *  1. Abra o formulário no modo edição → menu ⋮ (canto superior direito)
 *     → "Editor de script" (Apps Script).
 *  2. Apague o conteúdo padrão e cole TODO este arquivo.
 *  3. Troque o valor de API_KEY abaixo pela sua chave do CRM
 *     (CRM → Integrações → API Keys → gerar/copiar).
 *  4. Menu "Executar" → selecione a função "instalarGatilho" → Executar.
 *     Autorize o acesso quando o Google pedir (é seu próprio form).
 *  5. Pronto. Faça um envio de teste e confira em CRM → Leads.
 *
 * Para testar sem preencher o form: rode a função "testarEnvio".
 * ============================================================================
 */

// ►►► CONFIGURAÇÃO — troque apenas estas duas linhas ◄◄◄
var API_KEY  = "COLE_AQUI_SUA_API_KEY_DO_CRM";
var ENDPOINT = "https://kschuwekbrrwmhzinsrv.supabase.co/functions/v1/lead-capture";

/**
 * Mapa: título EXATO da pergunta no formulário → como o dado entra no CRM.
 * "campo" especial: name, email, phone, title  → colunas do contato.
 * Qualquer outro nome vira um campo estruturado (metadata) exibido no lead.
 * Se você renomear uma pergunta no form, ajuste o texto à esquerda aqui.
 */
var MAPA = {
  "Nome completo":                                                              "name",
  "Email":                                                                      "email",
  "Telefone":                                                                   "phone",
  "Especialidade Médica":                                                       "title",
  "Instagram Profissional (Opcional)":                                          "instagram",
  "Cidade/Estado":                                                              "cidade",
  "CRM / CREFITO (se aplicável)":                                               "registro_profissional",
  "Local de Atuação":                                                           "local_atuacao",
  "Já utiliza Ondas de Choque?":                                                "usa_ondas_choque",
  "Qual equipamento?":                                                          "equipamento_atual",
  "Qual seu nível de interesse na tecnologia Likawave?":                        "interesse",
  "Quais tratamentos pretende realizar?":                                       "tratamentos",
  "Quantos pacientes com indicação para ondas de choque você atende por mês?":  "pacientes_mes",
  "Agendamento de demonstração":                                               "agendamento_demo",
  "Autorização":                                                                "autorizacao",
  "USO INTERNO - CLASSIFICAÇÃO DO LEAD":                                         "classificacao_lead",
  "RESPONSÁVEL PELO CADASTRO":                                                   "responsavel_cadastro"
};

// Campos que são colunas diretas do contato (o resto vai para metadata)
var CAMPOS_CONTATO = ["name", "email", "phone", "title"];

function onFormSubmit(e) {
  try {
    var respostas = e.response.getItemResponses();
    var payload = { source: "cadastro_likawave", custom_fields: {} };

    for (var i = 0; i < respostas.length; i++) {
      var titulo = respostas[i].getItem().getTitle().trim();
      var valor  = respostas[i].getResponse();
      if (Array.isArray(valor)) valor = valor.join(", "); // checkbox → texto
      if (valor === "" || valor == null) continue;

      var destino = MAPA[titulo];
      if (!destino) continue; // pergunta sem mapeamento → ignora

      if (CAMPOS_CONTATO.indexOf(destino) >= 0) {
        payload[destino] = String(valor);
      } else {
        payload.custom_fields[destino] = String(valor);
      }
    }

    if (!payload.name) {
      Logger.log("Lead sem nome — envio abortado. Verifique o título da pergunta 'Nome completo'.");
      return;
    }

    var res = UrlFetchApp.fetch(ENDPOINT, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Api-Key": API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    Logger.log("CRM respondeu [" + res.getResponseCode() + "]: " + res.getContentText());
  } catch (err) {
    Logger.log("Erro ao enviar lead para o CRM: " + err);
  }
}

/** Cria o gatilho que dispara onFormSubmit a cada resposta. Rode UMA vez. */
function instalarGatilho() {
  var form = FormApp.getActiveForm();
  // Remove gatilhos duplicados desta mesma função (idempotente)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();
  Logger.log("Gatilho instalado com sucesso. As próximas respostas irão para o CRM.");
}

/**
 * IMPORTAÇÃO ÚNICA das respostas JÁ existentes no formulário.
 * Use isto para trazer os cadastros antigos (as respostas que chegaram antes
 * de você instalar o gatilho). Rode UMA vez.
 *
 * Trava de segurança: guarda uma marca ao terminar; se rodar de novo, avisa e
 * não faz nada (evita leads duplicados). Para forçar nova importação, rode
 * "resetarImportacao" antes.
 */
function importarRespostasExistentes() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("importacao_feita") === "sim") {
    Logger.log("⚠️ A importação já foi feita antes. Para rodar de novo, execute 'resetarImportacao' primeiro.");
    return;
  }

  var respostas = FormApp.getActiveForm().getResponses();
  var enviados = 0, pulados = 0, erros = 0;

  for (var r = 0; r < respostas.length; r++) {
    var itens = respostas[r].getItemResponses();
    var payload = { source: "cadastro_likawave", custom_fields: {} };

    for (var i = 0; i < itens.length; i++) {
      var titulo = itens[i].getItem().getTitle().trim();
      var valor  = itens[i].getResponse();
      if (Array.isArray(valor)) valor = valor.join(", ");
      if (valor === "" || valor == null) continue;
      var destino = MAPA[titulo];
      if (!destino) continue;
      if (CAMPOS_CONTATO.indexOf(destino) >= 0) payload[destino] = String(valor);
      else payload.custom_fields[destino] = String(valor);
    }

    if (!payload.name) { pulados++; continue; }

    try {
      var res = UrlFetchApp.fetch(ENDPOINT, {
        method: "post", contentType: "application/json",
        headers: { "X-Api-Key": API_KEY },
        payload: JSON.stringify(payload), muteHttpExceptions: true
      });
      if (res.getResponseCode() === 201) {
        enviados++;
      } else {
        erros++;
        Logger.log("Falha na resposta " + (r + 1) + " [" + res.getResponseCode() + "]: " + res.getContentText());
      }
    } catch (e) {
      erros++;
      Logger.log("Erro na resposta " + (r + 1) + ": " + e);
    }
    Utilities.sleep(300); // pausa leve entre envios (respeita o rate limit)
  }

  if (erros === 0) props.setProperty("importacao_feita", "sim");
  Logger.log("Importação concluída: " + enviados + " enviados, " + pulados +
             " pulados (sem nome), " + erros + " com erro. Total de respostas: " + respostas.length);
}

/** Libera nova importação (apaga a trava de segurança). Use com cuidado. */
function resetarImportacao() {
  PropertiesService.getScriptProperties().deleteProperty("importacao_feita");
  Logger.log("Trava removida. Você pode rodar 'importarRespostasExistentes' novamente.");
}

/** Teste manual: cria um lead fictício no CRM sem precisar preencher o form. */
function testarEnvio() {
  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Api-Key": API_KEY },
    payload: JSON.stringify({
      name: "Teste Apps Script",
      email: "teste@likawave.com",
      phone: "11999999999",
      title: "Ortopedia",
      source: "cadastro_likawave",
      custom_fields: {
        cidade: "São Paulo/SP",
        interesse: "Alto",
        classificacao_lead: "A",
        responsavel_cadastro: "Script de teste"
      }
    }),
    muteHttpExceptions: true
  });
  Logger.log("CRM respondeu [" + res.getResponseCode() + "]: " + res.getContentText());
}
