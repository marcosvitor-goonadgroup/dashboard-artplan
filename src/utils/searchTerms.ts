import { ProcessedCampaignData, ProcessedSearchData } from '../types/campaign';

/**
 * Extrai as linhas de termo de busca (planilha Google Search) no formato do
 * card SearchTermsAnalysis. Linhas de Google Search do Consolidado, que vêm
 * por anúncio e sem termo, ficam de fora.
 *
 * Recebe dados já recortados pela tela (nível, período, veículo, PI), então o
 * card deve ser renderizado com `periodFilter="all"`.
 */
export const toSearchTermsData = (rows: ProcessedCampaignData[]): ProcessedSearchData[] =>
  rows
    .filter(d => d.searchTerm && d.searchTerm.trim() !== '')
    .map(d => ({
      date: d.date,
      campaignName: d.campaignName,
      searchTerm: d.searchTerm || '',
      cost: d.cost,
      impressions: d.impressions,
      clicks: d.clicks,
      veiculo: d.veiculo,
      campanha: d.campanha,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
    }));
