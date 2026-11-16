import { toSlug } from '../utils/slug';

/**
 * Configuração da agência e das fontes de dados deste dashboard.
 *
 * Este arquivo é o único lugar que precisa mudar para apontar a mesma casca
 * para outra agência/cliente. Nada mais no código deve conter ID de planilha,
 * nome de agência ou nome de cliente cravado.
 */

/** Nome da agência exibido nos cabeçalhos. */
export const AGENCY_NAME = 'Artplan';

/**
 * Clientes atendidos pela agência. Só linhas cujo "Cliente" bate com um destes
 * nomes entram no dashboard — é o que impede dado de outra agência de vazar,
 * já que a base de PIs é compartilhada entre agências do grupo.
 *
 * A comparação é feita por slug, então acento e caixa não importam.
 */
export const CLIENTS = ['SENAI', 'SESI', 'SUPERMERCADOS MUNDIAL'] as const;

/**
 * Cliente padrão, usado quando a planilha não preenche a coluna "Cliente".
 * `null` porque a agência tem mais de um cliente: sem a coluna não dá para
 * saber a quem a linha pertence, e ela fica sem cliente.
 */
export const DEFAULT_CLIENT: string | null = null;

/** Em dev passa pelo proxy do Vite (ver vite.config.ts) para evitar CORS. */
export const SHEETS_API_BASE = import.meta.env.DEV
  ? '/api-proxy'
  : 'https://nmbcoamazonia-api.vercel.app';

/** Monta a URL da API de planilhas a partir do ID e da aba. */
export const sheetUrl = (id: string, range?: string): string =>
  range
    ? `${SHEETS_API_BASE}/google/sheets/${id}/data?range=${encodeURIComponent(range)}`
    : `${SHEETS_API_BASE}/google/sheets/${id}/data`;

/** Planilhas de entrega consolidada (uma linha por dia/criativo). */
export const CAMPAIGN_SHEETS: Array<{ id: string; range: string }> = [
  // SENAI
  { id: '1CV-RGsN7QWeQjhtQ8NOLAUoPtfpf4J60uOKTdzqNNl8', range: 'Consolidado' },
  // SESI
  { id: '1XAP9OYa_1eZj7dl-8dE467u3kpkZzx0cywUUvlFDiHU', range: 'Consolidado' },
  // SUPERMERCADOS MUNDIAL
  { id: '1s5kDdMh0g1NP_FDkxDp5obPu6i7csuMtTYLlM5nnE78', range: 'Consolidado' }
];

/**
 * Planilhas do Google Search (uma linha por termo de busca).
 * Lista vazia desliga o card de Termos de Busca.
 *
 * O cliente vem da coluna "Account Name" quando a planilha não tem "Cliente".
 */
export const GOOGLE_SEARCH_SHEETS: Array<{ id: string; range: string }> = [
  // SESI
  { id: '1XAP9OYa_1eZj7dl-8dE467u3kpkZzx0cywUUvlFDiHU', range: 'Google Search' }
];

/**
 * Planilha de PIs (contratado x realizado), usada pelo card de PI.
 *
 * É uma base compartilhada entre várias agências do grupo. Como número de PI
 * não é único entre agências, `fetchPIInfo` cruza também pela coluna Cliente
 * — ver `matchesKnownClient`.
 *
 * `null` desliga o card em vez de cruzar com dados de outra agência.
 */
export const PI_INFO_SHEET: { id: string; ranges: string[] } | null = {
  id: '1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M',
  ranges: ['base', 'representacao']
};

/**
 * Planilhas de benchmark de mercado (aba "Bench").
 * Vazio = sem benchmark externo; o dashboard segue usando o benchmark interno
 * calculado sobre a própria entrega.
 */
export const BENCHMARK_SHEETS: Array<{ id: string; range: string }> = [
  { id: '1HykUxjCGGdveDS_5vlLOOkAq7Wkl058453xkYGTAzNM', range: 'Bench' },
  { id: '1abcar-ESRB_f8ytKGQ_ru_slZ67cXhjxKt8gL7TrEVw', range: 'Bench' }
];

const KNOWN_CLIENT_SLUGS = CLIENTS.map(toSlug);

/**
 * Diz se uma linha da planilha pertence a um cliente desta agência.
 * Linha sem cliente preenchido é aceita (fica sem cliente).
 */
export const matchesKnownClient = (cliente: string): boolean => {
  if (!cliente || cliente.trim() === '') return true;
  return KNOWN_CLIENT_SLUGS.includes(toSlug(cliente));
};
