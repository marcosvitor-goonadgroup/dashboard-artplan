import axios from 'axios';
import { ApiResponse, ProcessedCampaignData, ProcessedSearchData } from '../types/campaign';
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

const PI_INFO_API_URL = `${API_BASE}/google/sheets/1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M/data`;

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

/**
 * Busca informações de um PI específico
 */
export const fetchPIInfo = async (numeroPi: string) => {
  try {
    const response = await axios.get(PI_INFO_API_URL);

    if (!response.data.success || !response.data.data.values) {
      throw new Error('Formato de resposta inválido');
    }

    const values = response.data.data.values;

    // Remove zeros à esquerda para comparação
    const normalizedPi = numeroPi.replace(/^0+/, '');

    // Encontra todas as linhas com o número PI especificado
    // Compara removendo zeros à esquerda de ambos os lados
    const piRows = values.slice(1).filter((row: string[]) => {
      const rowPi = (row[2] || '').replace(/^0+/, '');
      return rowPi === normalizedPi;
    });

    if (piRows.length === 0) {
      return null;
    }

    // Agrupa informações por veículo
    // Colunas: [0] Agência, [1] Cliente, [2] Número PI, [3] Veículo, [4] Canal,
    //          [5] Formato, [6] Modelo Compra, [7] Valor Uni, [8] Desconto,
    //          [9] Valor Negociado, [10] Qtd, [11] TT Bruto, [12] Reaplicação,
    //          [13] Status, [14] Segmentação, [15] Alcance, [16] Inicio, [17] Fim,
    //          [18] Público, [19] Praça, [20] Objetivo
    const piInfo = piRows.map((row: string[]) => ({
      numeroPi: row[2] || '',
      veiculo: row[3] || '',
      canal: row[4] || '',
      formato: row[5] || '',
      modeloCompra: row[6] || '',
      valorNegociado: row[9] || '',
      quantidade: row[10] || '',
      totalBruto: row[11] || '',
      status: row[13] || '',
      segmentacao: row[14] || '',
      alcance: row[15] || '',
      inicio: row[16] || '',
      fim: row[17] || '',
      publico: row[18] || '',
      praca: row[19] || '',
      objetivo: row[20] || ''
    }));

    return piInfo;
  } catch (error) {
    console.error('Erro ao buscar informações do PI:', error);
    return null;
  }
};
