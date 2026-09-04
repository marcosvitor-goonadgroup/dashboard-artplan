import axios from 'axios';
import { ApiResponse, PIInfo, ProcessedCampaignData, ProcessedSearchData } from '../types/campaign';
import { parse } from 'date-fns';

const API_BASE = import.meta.env.DEV ? '/api-proxy' : 'https://nmbcoamazonia-api.vercel.app';

const CAMPAIGN_API_URLS = [
  `${API_BASE}/google/sheets/1CV-RGsN7QWeQjhtQ8NOLAUoPtfpf4J60uOKTdzqNNl8/data?range=Consolidado`,
  `${API_BASE}/google/sheets/1XAP9OYa_1eZj7dl-8dE467u3kpkZzx0cywUUvlFDiHU/data?range=Consolidado`,
  // SUPERMERCADOS MUNDIAL
  `${API_BASE}/google/sheets/1s5kDdMh0g1NP_FDkxDp5obPu6i7csuMtTYLlM5nnE78/data?range=Consolidado`
];

const SEARCH_API_URLS = [
  `${API_BASE}/google/sheets/1abcar-ESRB_f8ytKGQ_ru_slZ67cXhjxKt8gL7TrEVw/data?range=Search`,
  `${API_BASE}/google/sheets/1HykUxjCGGdveDS_5vlLOOkAq7Wkl058453xkYGTAzNM/data?range=Search`
];

const PI_INFO_API_URLS = [
  `${API_BASE}/google/sheets/1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M/data`,
  `${API_BASE}/google/sheets/1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M/data?range=representacao`
];

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

const parseDate = (dateString: string): Date => {
  try {
    return parse(dateString, 'dd/MM/yyyy', new Date());
  } catch {
    return new Date();
  }
};

const parseSearchDate = (dateString: string): Date => {
  try {
    // Format from API: "2025-04-08"
    return parse(dateString, 'yyyy-MM-dd', new Date());
  } catch {
    return new Date();
  }
};

const normalizeHeader = (header: string): string =>
  header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

// As planilhas dos clientes não compartilham exatamente as mesmas colunas
// (ex.: "Viewbility" só existe em algumas, "Image" só em outras), então a
// posição de cada campo é resolvida pelo cabeçalho, e não por índice fixo.
const buildColumnIndex = (headerRow: string[]): Record<string, number> => {
  const columns: Record<string, number> = {};
  headerRow.forEach((header, index) => {
    columns[normalizeHeader(header || '')] = index;
  });
  return columns;
};

const normalizeVeiculo = (veiculo: string): string => {
  const normalized = veiculo.trim();
  const lower = normalized.toLowerCase();
  if (lower === 'audience network' || lower === 'messenger' || lower === 'threads' || lower === 'unknown') {
    return 'Facebook';
  }
  return normalized;
};

export const fetchCampaignData = async (): Promise<ProcessedCampaignData[]> => {
  try {
    const responses = await Promise.all(
      CAMPAIGN_API_URLS.map(url => axios.get<ApiResponse>(url))
    );

    const allData: ProcessedCampaignData[] = [];

    responses.forEach(response => {
      if (response.data.success && response.data.data.values.length > 1) {
        const [headerRow, ...rows] = response.data.data.values;
        const columns = buildColumnIndex(headerRow);
        const piColumn = columns['numero pi'];

        const cell = (row: string[], header: string): string => {
          const index = columns[header];
          return index === undefined ? '' : (row[index] || '');
        };

        rows.forEach(row => {
          // Ignora linhas incompletas (a API omite as células vazias do fim)
          if (piColumn !== undefined && row.length <= piColumn) return;

          const numeroPi = cell(row, 'numero pi');
          const veiculo = normalizeVeiculo(cell(row, 'veiculo'));

          // Ignora linhas onde o Número PI é "#VALUE!", EXCETO para Google Search
          if (numeroPi === '#VALUE!' && veiculo !== 'Google Search') {
            return;
          }

          const dataRow: ProcessedCampaignData = {
            date: parseDate(cell(row, 'date')),
            campaignName: cell(row, 'campaign name'),
            adSetName: cell(row, 'ad set name'),
            adName: cell(row, 'ad name'),
            cost: parseCurrency(cell(row, 'cost')),
            impressions: parseNumber(cell(row, 'impressions')),
            reach: parseNumber(cell(row, 'reach')),
            clicks: parseNumber(cell(row, 'clicks')),
            videoViews: parseNumber(cell(row, 'video views')),
            videoViews25: parseNumber(cell(row, 'video views 25%')),
            videoViews50: parseNumber(cell(row, 'video views 50%')),
            videoViews75: parseNumber(cell(row, 'video views 75%')),
            videoCompletions: parseNumber(cell(row, 'video completions')),
            totalEngagements: parseNumber(cell(row, 'total engagements')),
            veiculo: veiculo,
            tipoDeCompra: cell(row, 'tipo de compra'),
            videoEstaticoAudio: cell(row, 'video_estatico_audio'),
            image: cell(row, 'image'),
            campanha: cell(row, 'campanha'),
            numeroPi: numeroPi,
            cliente: cell(row, 'cliente')
          };
          allData.push(dataRow);
        });
      }
    });

    return allData;
  } catch (error) {
    console.error('Erro ao buscar dados das campanhas:', error);
    throw error;
  }
};

export const fetchSearchTermsData = async (): Promise<ProcessedSearchData[]> => {
  try {
    const responses = await Promise.all(
      SEARCH_API_URLS.map(url => axios.get<ApiResponse>(url))
    );

    const allData: ProcessedSearchData[] = [];

    responses.forEach(response => {
      if (response.data.success && response.data.data.values.length > 1) {
        const rows = response.data.data.values.slice(1);

        rows.forEach(row => {
          if (row.length >= 6) {
            const impressions = parseNumber(row[4]);
            const clicks = parseNumber(row[5]);
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

            const dataRow: ProcessedSearchData = {
              date: parseSearchDate(row[0]),
              campaignName: row[1] || '',
              searchTerm: row[2] || '',
              cost: parseNumber(row[3]),
              impressions,
              clicks,
              veiculo: row[6] || 'Google Search',
              campanha: row[7] || '',
              ctr
            };
            allData.push(dataRow);
          }
        });
      }
    });

    return allData;
  } catch (error) {
    console.error('Erro ao buscar dados de termos de busca:', error);
    throw error;
  }
};

/**
 * Converte dados do Google Search para o formato ProcessedCampaignData
 */
export const convertSearchDataToCampaignData = (searchData: ProcessedSearchData[]): ProcessedCampaignData[] => {
  return searchData.map(item => ({
    date: item.date,
    campaignName: item.campaignName,
    adSetName: item.searchTerm,
    adName: item.searchTerm,
    cost: item.cost,
    impressions: item.impressions,
    reach: 0,
    clicks: item.clicks,
    videoViews: 0,
    videoViews25: 0,
    videoViews50: 0,
    videoViews75: 0,
    videoCompletions: 0,
    totalEngagements: 0,
    veiculo: 'Google Search',
    tipoDeCompra: 'CPC',
    videoEstaticoAudio: '',
    image: '',
    campanha: item.campanha,
    numeroPi: '',
    cliente: ''
  }));
};

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
      const columns = buildColumnIndex(headerRow);

      const cell = (row: string[], ...headers: string[]): string => {
        for (const header of headers) {
          const columnIndex = columns[header];
          if (columnIndex !== undefined) return row[columnIndex] || '';
        }
        return '';
      };

      rows
        .filter(row => normalizePiNumber(cell(row, 'numero pi')) === normalizedPi)
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
