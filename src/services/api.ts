import axios from 'axios';
import { ApiResponse, PIInfo, ProcessedCampaignData } from '../types/campaign';
import { parse, startOfDay } from 'date-fns';
import {
  AGENCY_NAME,
  CAMPAIGN_SHEETS,
  DEFAULT_CLIENT,
  GOOGLE_SEARCH_SHEETS,
  PI_INFO_SHEET,
  matchesKnownClient,
  sheetUrl
} from '../config/agency';

const CAMPAIGN_API_URLS = CAMPAIGN_SHEETS.map(s => sheetUrl(s.id, s.range));

// Google Search vem de planilhas próprias, com granularidade por termo de busca
// (uma linha por termo/dia) e cabeçalho diferente do Consolidado.
const GOOGLE_SEARCH_API_URLS = GOOGLE_SEARCH_SHEETS.map(s => sheetUrl(s.id, s.range));

const PI_INFO_API_URLS = PI_INFO_SHEET
  ? PI_INFO_SHEET.ranges.map(range => sheetUrl(PI_INFO_SHEET!.id, range))
  : [];

const parseNumber = (value: string): number => {
  if (!value || value === '') return 0;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const parseCurrency = (value: string): number => {
  if (!value || value === '') return 0;
  // Remove "R$" e espaços, depois processa como número
  const cleaned = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// Serial de data do Google Sheets/Excel: dias corridos desde 30/12/1899.
// Algumas planilhas exportam a data já formatada ("07/09/2026"), outras
// entregam o número cru ("46272") — as duas formas chegam aqui.
const parseSheetSerialDate = (serial: number): Date => new Date(1899, 11, 30 + serial);

/** Aceita "dd/MM/yyyy" (Consolidado), "yyyy-MM-dd" (Google Search) e serial. */
const parseDate = (dateString: string): Date => {
  try {
    const trimmed = (dateString || '').trim();
    if (!trimmed) return startOfDay(new Date());

    // Faixa defensiva: 1/1/1970 (25569) até 2100 (73415).
    if (/^\d+$/.test(trimmed)) {
      const serial = Number(trimmed);
      if (serial >= 25569 && serial <= 73415) {
        return startOfDay(parseSheetSerialDate(serial));
      }
    }

    if (trimmed.includes('/')) {
      return startOfDay(parse(trimmed, 'dd/MM/yyyy', new Date()));
    }
    return startOfDay(parse(trimmed, 'yyyy-MM-dd', new Date()));
  } catch {
    return startOfDay(new Date());
  }
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

const normalizeHeader = (header: string): string =>
  (header || '').toLowerCase().normalize('NFD').replace(DIACRITICS, '').trim();

// As planilhas não compartilham exatamente as mesmas colunas (ex.:
// "Viewbility" só existe em algumas, "Image" só em outras), então a posição de
// cada campo é resolvida pelo cabeçalho, e não por índice fixo.
const buildColumnIndex = (headerRow: string[]): Record<string, number> => {
  const columns: Record<string, number> = {};
  headerRow.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!(key in columns)) columns[key] = index;
  });
  return columns;
};

/** Lê a célula da primeira coluna existente entre os nomes aceitos. */
const makeCellReader = (columns: Record<string, number>) =>
  (row: string[], ...headers: string[]): string => {
    for (const header of headers) {
      const index = columns[header];
      if (index !== undefined) return row[index] || '';
    }
    return '';
  };

const normalizeVeiculo = (veiculo: string): string => {
  const normalized = veiculo.trim();
  const lower = normalized.toLowerCase();
  if (lower === 'audience network' || lower === 'messenger' || lower === 'threads' || lower === 'unknown') {
    return 'Facebook';
  }
  return normalized;
};

const resolveCliente = (cliente: string): string => cliente || DEFAULT_CLIENT || '';

const mapConsolidadoData = (values: string[][]): ProcessedCampaignData[] => {
  if (!values || values.length <= 1) return [];

  const [headerRow, ...rows] = values;
  const columns = buildColumnIndex(headerRow);
  const cell = makeCellReader(columns);
  const piColumn = columns['numero pi'];

  const out: ProcessedCampaignData[] = [];
  rows.forEach(row => {
    // Ignora linhas incompletas (a API omite as células vazias do fim)
    if (piColumn !== undefined && row.length <= piColumn) return;

    const numeroPi = cell(row, 'numero pi');
    const veiculo = normalizeVeiculo(cell(row, 'veiculo'));

    // Ignora linhas onde o Número PI é "#VALUE!", EXCETO para Google Search
    if (numeroPi === '#VALUE!' && veiculo !== 'Google Search') return;

    // Só entra linha de cliente desta agência.
    const cliente = cell(row, 'cliente');
    if (!matchesKnownClient(cliente)) return;

    out.push({
      date: parseDate(cell(row, 'date', 'data')),
      campaignName: cell(row, 'campaign name'),
      adSetName: cell(row, 'ad set name', 'ad group name'),
      adName: cell(row, 'ad name'),
      cost: parseCurrency(cell(row, 'cost', 'investimento')),
      impressions: parseNumber(cell(row, 'impressions')),
      reach: parseNumber(cell(row, 'reach')),
      clicks: parseNumber(cell(row, 'clicks')),
      videoViews: parseNumber(cell(row, 'video views', 'video view')),
      videoViews25: parseNumber(cell(row, 'video views 25%', 'views 25%')),
      videoViews50: parseNumber(cell(row, 'video views 50%', 'views 50%')),
      videoViews75: parseNumber(cell(row, 'video views 75%', 'views 75%')),
      videoCompletions: parseNumber(cell(row, 'video completions', 'views 100%')),
      totalEngagements: parseNumber(cell(row, 'total engagements', 'engajamento')),
      veiculo,
      tipoDeCompra: cell(row, 'tipo de compra'),
      videoEstaticoAudio: cell(row, 'video_estatico_audio', 'formato'),
      image: cell(row, 'image'),
      campanha: cell(row, 'campanha'),
      numeroPi,
      cliente: resolveCliente(cliente),
      agencia: cell(row, 'agencia') || AGENCY_NAME
    });
  });

  return out;
};

// Mapeia a planilha do Google Search (linha por termo de busca) para o mesmo
// formato ProcessedCampaignData usado no restante do dashboard, preservando o
// termo em `searchTerm`. Assim a entrega já entra somada nos totais, no card
// do PI e em Performance por Veículo, sem tratamento especial.
const mapGoogleSearchData = (values: string[][]): ProcessedCampaignData[] => {
  if (!values || values.length <= 1) return [];

  const [headerRow, ...rows] = values;
  const cell = makeCellReader(buildColumnIndex(headerRow));

  const out: ProcessedCampaignData[] = [];
  rows.forEach(row => {
    if (row.length === 0) return;

    const campanha = cell(row, 'campanha');
    if (!campanha || campanha.trim() === '') return;

    // A planilha do Google Search não tem "Cliente": a conta do Google Ads
    // ("Account Name") leva o nome do cliente.
    const cliente = cell(row, 'cliente', 'account name');
    if (!matchesKnownClient(cliente)) return;

    out.push({
      date: parseDate(cell(row, 'day', 'date', 'data')),
      campaignName: cell(row, 'campaign name'),
      adSetName: cell(row, 'ad group name'),
      adName: '',
      // "Investimento" é o custo negociado (cliques × CPC do PI); "Cost (Spend)"
      // é o gasto bruto da plataforma — só usado se a coluna calculada faltar.
      cost: parseCurrency(cell(row, 'investimento', 'cost (spend)', 'cost')),
      impressions: parseNumber(cell(row, 'impressions')),
      reach: 0,
      clicks: parseNumber(cell(row, 'clicks')),
      videoViews: 0,
      videoViews25: 0,
      videoViews50: 0,
      videoViews75: 0,
      videoCompletions: 0,
      totalEngagements: parseNumber(cell(row, 'engagements', 'total engagements')),
      veiculo: normalizeVeiculo(cell(row, 'veiculo') || 'Google Search'),
      tipoDeCompra: cell(row, 'tipo de compra'),
      videoEstaticoAudio: '',
      image: '',
      campanha,
      numeroPi: cell(row, 'pi', 'numero pi'),
      cliente: resolveCliente(cliente),
      agencia: cell(row, 'agencia') || AGENCY_NAME,
      searchTerm: cell(row, 'search term', 'search keyword')
    });
  });

  return out;
};

const fetchGoogleSearchData = async (): Promise<ProcessedCampaignData[]> => {
  const results = await Promise.allSettled(
    GOOGLE_SEARCH_API_URLS.map(url => axios.get<ApiResponse>(url))
  );

  const out: ProcessedCampaignData[] = [];
  results.forEach((result, index) => {
    // Falha no Google Search não deve derrubar o carregamento do restante.
    if (result.status === 'rejected') {
      console.error(`Erro ao buscar dados do Google Search (${GOOGLE_SEARCH_API_URLS[index]}):`, result.reason);
      return;
    }
    if (!result.value.data.success) return;
    out.push(...mapGoogleSearchData(result.value.data.data.values));
  });
  return out;
};

export const fetchCampaignData = async (): Promise<ProcessedCampaignData[]> => {
  try {
    const [responses, googleSearchData] = await Promise.all([
      Promise.all(CAMPAIGN_API_URLS.map(url => axios.get<ApiResponse>(url))),
      fetchGoogleSearchData()
    ]);

    const allData: ProcessedCampaignData[] = [];
    responses.forEach(response => {
      if (!response.data.success) return;
      allData.push(...mapConsolidadoData(response.data.data.values));
    });
    allData.push(...googleSearchData);

    return allData;
  } catch (error) {
    console.error('Erro ao buscar dados das campanhas:', error);
    throw error;
  }
};

/** A planilha de PI está configurada para esta agência? */
export const hasPIInfoSource = (): boolean => PI_INFO_API_URLS.length > 0;

// Compara PIs vindos de planilhas com formatações diferentes, ignorando zeros
// à esquerda e separador de milhar ("447555", "0447555", "261.633").
const normalizePiNumber = (numeroPi: string): string =>
  (numeroPi || '').replace(/\./g, '').replace(/^0+/, '');

/**
 * Busca informações de um PI específico em todas as fontes de PI.
 * Cada aba tem seu próprio conjunto de colunas, então os campos são resolvidos
 * pelo cabeçalho, aceitando os nomes equivalentes usados em cada uma.
 */
export const fetchPIInfo = async (numeroPi: string): Promise<PIInfo[] | null> => {
  if (PI_INFO_API_URLS.length === 0) return null;

  try {
    const responses = await Promise.allSettled(
      PI_INFO_API_URLS.map(url => axios.get<ApiResponse>(url))
    );

    const normalizedPi = normalizePiNumber(numeroPi);
    const piInfo: PIInfo[] = [];

    responses.forEach((result, index) => {
      // Uma fonte indisponível não pode derrubar as demais
      if (result.status === 'rejected') {
        console.error(`Erro ao buscar a fonte de PI ${PI_INFO_API_URLS[index]}:`, result.reason);
        return;
      }

      const response = result.value;
      if (!response.data.success || !response.data.data.values?.length) return;

      const [headerRow, ...rows] = response.data.data.values;
      const cell = makeCellReader(buildColumnIndex(headerRow));

      rows
        // A base é compartilhada entre agências: o número do PI sozinho não
        // basta, o cliente da linha também precisa ser desta agência.
        .filter(row =>
          normalizePiNumber(cell(row, 'numero pi')) === normalizedPi &&
          matchesKnownClient(cell(row, 'cliente'))
        )
        .forEach(row => {
          piInfo.push({
            numeroPi: cell(row, 'numero pi'),
            veiculo: cell(row, 'veiculo'),
            canal: cell(row, 'canal'),
            formato: cell(row, 'formato'),
            modeloCompra: cell(row, 'modelo compra', 'modelos'),
            valorNegociado: cell(row, 'valor negociado', 'valor unitario desc.'),
            quantidade: cell(row, 'qtd', 'volume'),
            totalBruto: cell(row, 'tt bruto', 'bruto negociado'),
            status: cell(row, 'status'),
            segmentacao: cell(row, 'segmentacao'),
            alcance: cell(row, 'alcance'),
            inicio: cell(row, 'inicio'),
            fim: cell(row, 'fim'),
            publico: cell(row, 'publico'),
            praca: cell(row, 'praca'),
            objetivo: cell(row, 'objetivo')
          });
        });
    });

    return piInfo.length > 0 ? piInfo : null;
  } catch (error) {
    console.error('Erro ao buscar informações do PI:', error);
    return null;
  }
};
