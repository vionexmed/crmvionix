import Inbox from "./Inbox";

/**
 * Caixa de Email Marketing — mesma inbox do atendimento, filtrada para a
 * conta Gmail de marketing da empresa (purpose = "marketing"). Antes esta
 * página era um stub estático que nunca mostrava e-mails.
 */
export default function InboxMarketing() {
  return <Inbox purpose="marketing" />;
}
