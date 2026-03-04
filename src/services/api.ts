import axios from 'axios';
import { ApiResponse, ProcessedCampaignData, ProcessedSearchData, PricingTableRow } from '../types/campaign';
import { parse } from 'date-fns';

const CAMPAIGN_API_URLS = [
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1CV-RGsN7QWeQjhtQ8NOLAUoPtfpf4J60uOKTdzqNNl8/data?range=Consolidado',
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1XAP9OYa_1eZj7dl-8dE467u3kpkZzx0cywUUvlFDiHU/data?range=Consolidado'
];

const SEARCH_API_URLS = [
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1abcar-ESRB_f8ytKGQ_ru_slZ67cXhjxKt8gL7TrEVw/data?range=Search',
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1HykUxjCGGdveDS_5vlLOOkAq7Wkl058453xkYGTAzNM/data?range=Search'
];

const PRICING_API_URL = 'https://nmbcoamazonia-api.vercel.app/google/sheets/1zgRBEs_qi_9DdYLqw-cEedD1u66FS88ku6zTZ0gV-oU/data?range=base';

const PI_INFO_API_URL = 'https://nmbcoamazonia-api.vercel.app/google/sheets/1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M/data';

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

const parsePercentage = (value: string): number => {
  if (!value || value === '') return 0;
  // Remove "%" e converte para decimal
  const cleaned = value.replace('%', '').trim().replace(',', '.');
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

const normalizeVeiculo = (veiculo: string): string => {
  const normalized = veiculo.trim();
  if (normalized === 'Audience Network' || normalized === 'Messenger') {
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
        const rows = response.data.data.values.slice(1);

        rows.forEach(row => {
          if (row.length >= 20) {
            const numeroPi = row[19] || '';
            const veiculoRaw = row[14] || '';
            const veiculo = normalizeVeiculo(veiculoRaw);
            const cliente = row[20] || '';

            // Ignora linhas onde o Número PI é "#VALUE!", EXCETO para Google Search
            if (numeroPi === '#VALUE!' && veiculo !== 'Google Search') {
              return;
            }

            const dataRow: ProcessedCampaignData = {
              date: parseDate(row[0]),
              campaignName: row[1] || '',
              adSetName: row[2] || '',
              adName: row[3] || '',
              cost: parseCurrency(row[4]),
              impressions: parseNumber(row[5]),
              reach: parseNumber(row[6]),
              clicks: parseNumber(row[7]),
              videoViews: parseNumber(row[8]),
              videoViews25: parseNumber(row[9]),
              videoViews50: parseNumber(row[10]),
              videoViews75: parseNumber(row[11]),
              videoCompletions: parseNumber(row[12]),
              totalEngagements: parseNumber(row[13]),
              veiculo: veiculo,
              tipoDeCompra: row[15] || '',
              videoEstaticoAudio: row[16] || '',
              image: row[17] || '',
              campanha: row[18] || '',
              numeroPi: numeroPi,
              cliente: cliente
            };
            allData.push(dataRow);
          }
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

export const fetchPricingTable = async (): Promise<PricingTableRow[]> => {
  try {
    const response = await axios.get<ApiResponse>(PRICING_API_URL);

    if (response.data.success && response.data.data.values.length > 1) {
      const rows = response.data.data.values.slice(1); // Pula o header

      const pricingData: PricingTableRow[] = rows.map(row => ({
        veiculo: row[0] || '',
        canal: row[1] || '',
        formato: row[2] || '',
        tipoDeCompra: row[3] || '',
        valorUnitario: parseCurrency(row[4]),
        desconto: parsePercentage(row[5]),
        valorFinal: parseCurrency(row[6])
      }));

      return pricingData;
    }

    return [];
  } catch (error) {
    console.error('Erro ao buscar tabela de preços:', error);
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
      const rowPi = (row[0] || '').replace(/^0+/, '');
      return rowPi === normalizedPi;
    });

    if (piRows.length === 0) {
      return null;
    }

    // Agrupa informações por veículo
    const piInfo = piRows.map((row: string[]) => ({
      numeroPi: row[0] || '',
      veiculo: row[1] || '',
      canal: row[2] || '',
      formato: row[3] || '',
      modeloCompra: row[4] || '',
      valorNegociado: row[7] || '',
      quantidade: row[8] || '',
      totalBruto: row[9] || '',
      status: row[11] || '',
      segmentacao: row[12] || '',
      alcance: row[13] || '',
      inicio: row[14] || '',
      fim: row[15] || '',
      publico: row[16] || '',
      praca: row[17] || '',
      objetivo: row[18] || ''
    }));

    return piInfo;
  } catch (error) {
    console.error('Erro ao buscar informações do PI:', error);
    return null;
  }
};
