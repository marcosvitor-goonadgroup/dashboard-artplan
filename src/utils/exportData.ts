import { format, isValid } from 'date-fns';
import { ProcessedCampaignData } from '../types/campaign';
import { toSlug } from './slug';

/**
 * Exportação da base consolidada em CSV e Excel.
 *
 * As duas saídas são geradas a partir da MESMA definição de colunas (`COLUMNS`),
 * então incluir/remover/reordenar uma coluna é mexer numa linha só e os dois
 * formatos acompanham.
 */

type ExportValue = string | number | Date | null;

type ExportType = 'text' | 'number' | 'currency' | 'percent' | 'date';

interface ExportColumn {
  header: string;
  type: ExportType;
  value: (row: ProcessedCampaignData) => ExportValue;
  /** Largura da coluna no Excel (ignorada no CSV). */
  width?: number;
}

/** Razão em porcentagem; `null` quando não há denominador (evita 0 falso). */
const ratio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

/** Custo por unidade; `null` quando não há unidade. */
const perUnit = (spend: number, units: number): number | null =>
  units > 0 ? spend / units : null;

const COLUMNS: ExportColumn[] = [
  // --- Identificação ---
  { header: 'Data', type: 'date', width: 12, value: r => r.date },
  { header: 'Cliente', type: 'text', width: 22, value: r => r.cliente },
  { header: 'Agência', type: 'text', width: 14, value: r => r.agencia },
  { header: 'Campanha', type: 'text', width: 32, value: r => r.campanha },
  { header: 'Número PI', type: 'text', width: 12, value: r => r.numeroPi },
  { header: 'Veículo', type: 'text', width: 16, value: r => r.veiculo },
  { header: 'Tipo de Compra', type: 'text', width: 14, value: r => r.tipoDeCompra },
  { header: 'Formato', type: 'text', width: 14, value: r => r.videoEstaticoAudio },

  // --- Nomenclatura da plataforma ---
  { header: 'Nome da Campanha', type: 'text', width: 40, value: r => r.campaignName },
  { header: 'Grupo de Anúncios', type: 'text', width: 32, value: r => r.adSetName },
  { header: 'Anúncio', type: 'text', width: 32, value: r => r.adName },
  { header: 'Termo de Busca', type: 'text', width: 26, value: r => r.searchTerm ?? '' },

  // --- Entrega (valores brutos, somáveis em tabela dinâmica) ---
  { header: 'Investimento (R$)', type: 'currency', width: 16, value: r => r.cost },
  { header: 'Impressões', type: 'number', width: 13, value: r => r.impressions },
  { header: 'Alcance', type: 'number', width: 12, value: r => r.reach },
  { header: 'Cliques', type: 'number', width: 11, value: r => r.clicks },
  { header: 'Views', type: 'number', width: 12, value: r => r.videoViews },
  { header: 'Views 25%', type: 'number', width: 12, value: r => r.videoViews25 },
  { header: 'Views 50%', type: 'number', width: 12, value: r => r.videoViews50 },
  { header: 'Views 75%', type: 'number', width: 12, value: r => r.videoViews75 },
  { header: 'Views 100%', type: 'number', width: 12, value: r => r.videoCompletions },
  { header: 'Engajamento', type: 'number', width: 13, value: r => r.totalEngagements },

  // --- Métricas derivadas (por linha; não somar, recalcular) ---
  { header: 'CTR (%)', type: 'percent', width: 10, value: r => ratio(r.clicks, r.impressions) },
  { header: 'VTR (%)', type: 'percent', width: 10, value: r => ratio(r.videoCompletions, r.impressions) },
  { header: 'CPM (R$)', type: 'currency', width: 11, value: r => perUnit(r.cost * 1000, r.impressions) },
  { header: 'CPC (R$)', type: 'currency', width: 11, value: r => perUnit(r.cost, r.clicks) },

  // --- Criativo ---
  { header: 'Imagem (URL)', type: 'text', width: 40, value: r => r.image },
];

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const DELIMITER = ';';
const EOL = '\r\n';
const BOM = '﻿';

/**
 * Escapa um campo conforme RFC 4180: envolve em aspas quando há delimitador,
 * aspas ou quebra de linha, e também quando há espaço nas bordas (que o Excel
 * comeria silenciosamente). Aspas internas viram aspas duplas.
 */
const escapeCsv = (value: string): string => {
  if (!value) return '';
  const needsQuotes = /[";\r\n]/.test(value) || value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
};

/**
 * Converte o valor tipado para texto pt-BR.
 * Números saem SEM separador de milhar (funciona em qualquer locale) e com
 * vírgula decimal (única forma de virar célula numérica no Excel pt-BR).
 */
const toCsvText = (value: ExportValue, type: ExportType): string => {
  if (value === null || value === undefined) return '';

  if (type === 'date') {
    const date = value as Date;
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  }

  if (type === 'text') return String(value);

  const num = value as number;
  if (!Number.isFinite(num)) return '';

  // Moeda e porcentagem com 2 casas fixas; contagens sem casas forçadas.
  const text = type === 'number' ? String(num) : num.toFixed(2);
  return text.replace('.', ',');
};

/** Serializa as linhas em CSV, já com BOM (pronto para virar Blob). */
export const buildCsv = (rows: ProcessedCampaignData[]): string => {
  const lines = new Array<string>(rows.length + 1);

  lines[0] = COLUMNS.map(c => escapeCsv(c.header)).join(DELIMITER);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = new Array<string>(COLUMNS.length);
    for (let c = 0; c < COLUMNS.length; c++) {
      const column = COLUMNS[c];
      cells[c] = escapeCsv(toCsvText(column.value(row), column.type));
    }
    lines[i + 1] = cells.join(DELIMITER);
  }

  return BOM + lines.join(EOL) + EOL;
};

// ---------------------------------------------------------------------------
// Nome do arquivo e download
// ---------------------------------------------------------------------------

/** Ex.: `ad-desk-base-completa-2026-09-09` (sem extensão). */
export const buildFileName = (baseName: string): string =>
  `${toSlug(baseName)}-${format(new Date(), 'yyyy-MM-dd')}`;

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revogar de imediato cancela o download em Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadCsv = (
  rows: ProcessedCampaignData[],
  baseName = 'ad-desk-base-completa'
): void => {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${buildFileName(baseName)}.csv`);
};

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

/** Máscara de número do Excel por tipo de coluna. */
const XLSX_FORMAT: Record<ExportType, string | undefined> = {
  text: undefined,
  number: '#,##0',
  currency: '#,##0.00',
  percent: '0.00',
  date: 'dd/mm/yyyy',
};

/**
 * Gera o .xlsx e dispara o download.
 *
 * A lib entra por `import()` dinâmico para o Vite emitir um chunk separado —
 * só quem clica em "Excel" paga o download dela.
 */
export const downloadXlsx = async (
  rows: ProcessedCampaignData[],
  baseName = 'ad-desk-base-completa'
): Promise<void> => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const columns = COLUMNS.map(column => ({
    header: { value: column.header, fontWeight: 'bold' as const },
    width: column.width,
    cell: (row: ProcessedCampaignData) => {
      const value = column.value(row);
      if (value === null || value === undefined || value === '') return null;

      if (column.type === 'date') {
        const date = value as Date;
        if (!isValid(date)) return null;
        return { value: date, type: Date, format: XLSX_FORMAT.date };
      }

      if (column.type === 'text') {
        return { value: String(value), type: String };
      }

      const num = value as number;
      if (!Number.isFinite(num)) return null;
      return { value: num, type: Number, format: XLSX_FORMAT[column.type] };
    },
  }));

  await writeXlsxFile(rows, {
    columns,
    sheet: 'Base',
    stickyRowsCount: 1,
  }).toFile(`${buildFileName(baseName)}.xlsx`);
};
