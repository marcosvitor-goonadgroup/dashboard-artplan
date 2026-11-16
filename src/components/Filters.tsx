import { useState, useMemo, useEffect } from 'react';
import { useCampaign } from '../contexts/CampaignContext';
import { subDays, startOfYear, endOfYear, subMonths } from 'date-fns';
import { DateRangePicker, RangeKeyDict, Range } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './DateRangePicker.css';
import { ptBR } from 'date-fns/locale';
import { ProcessedCampaignData } from '../types/campaign';
import { downloadCsv, downloadXlsx } from '../utils/exportData';

interface FiltersProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Conjunto a exportar. Quando omitido, exporta toda a base carregada.
   * O contexto não é escopado por cliente, então telas de um cliente
   * específico precisam passar o próprio recorte aqui.
   */
  exportRows?: ProcessedCampaignData[];
  /** Base do nome do arquivo, sem data e sem extensão. */
  exportFileName?: string;
}

const Filters = ({ isOpen, onClose, exportRows, exportFileName }: FiltersProps) => {
  const { filters, setFilters, availableFilters, data } = useCampaign();

  const [isExporting, setIsExporting] = useState<'csv' | 'xlsx' | null>(null);

  const [localFilters, setLocalFilters] = useState(filters);
  const [dateRange, setDateRange] = useState<Range[]>([
    {
      startDate: filters.dateRange.start || undefined,
      endDate: filters.dateRange.end || undefined,
      key: 'selection'
    }
  ]);

  // Sincroniza localFilters quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
      setDateRange([
        {
          startDate: filters.dateRange.start || undefined,
          endDate: filters.dateRange.end || undefined,
          key: 'selection'
        }
      ]);
    }
  }, [isOpen, filters]);

  // Data máxima permitida é D-1 (ontem)
  const maxDate = useMemo(() => subDays(new Date(), 1), []);

  // Obtém a data mínima disponível nos dados
  const minDate = useMemo(() => {
    if (data.length === 0) return new Date();
    return new Date(Math.min(...data.map(d => d.date.getTime())));
  }, [data]);

  // Filtra os Números PI disponíveis baseado nos filtros locais ativos
  const filteredNumerosPi = useMemo(() => {
    let filtered = [...data];

    // Aplica filtro de data
    if (localFilters.dateRange.start) {
      filtered = filtered.filter(d => d.date >= localFilters.dateRange.start!);
    }
    if (localFilters.dateRange.end) {
      filtered = filtered.filter(d => d.date <= localFilters.dateRange.end!);
    }

    // Aplica filtro de campanha
    if (localFilters.campanha.length > 0) {
      filtered = filtered.filter(d => localFilters.campanha.includes(d.campanha));
    }

    // Aplica filtro de veículo
    if (localFilters.veiculo.length > 0) {
      filtered = filtered.filter(d => localFilters.veiculo.includes(d.veiculo));
    }

    // Aplica filtro de tipo de compra
    if (localFilters.tipoDeCompra.length > 0) {
      filtered = filtered.filter(d => localFilters.tipoDeCompra.includes(d.tipoDeCompra));
    }

    // Extrai Números PI únicos do dataset filtrado
    return Array.from(new Set(filtered.map(d => d.numeroPi).filter(Boolean)));
  }, [data, localFilters.dateRange, localFilters.campanha, localFilters.veiculo, localFilters.tipoDeCompra]);

  const handleDateChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection;
    setDateRange([selection]);
    setLocalFilters(prev => ({
      ...prev,
      dateRange: {
        start: selection.startDate || null,
        end: selection.endDate || null
      }
    }));
  };

  const handlePresetClick = (start: Date, end: Date) => {
    setDateRange([
      {
        startDate: start,
        endDate: end,
        key: 'selection'
      }
    ]);
    setLocalFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }));
  };

  const handleApply = () => {
    setFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      dateRange: { start: null, end: null },
      veiculo: [],
      tipoDeCompra: [],
      campanha: [],
      numeroPi: null
    };
    setLocalFilters(clearedFilters);
    setFilters(clearedFilters);
    setDateRange([
      {
        startDate: undefined,
        endDate: undefined,
        key: 'selection'
      }
    ]);
  };

  // Download sempre da base completa — independente dos filtros aplicados.
  const rowsToExport = exportRows ?? data;

  const rowCountLabel = useMemo(
    () => new Intl.NumberFormat('pt-BR').format(rowsToExport.length),
    [rowsToExport.length]
  );

  const handleExport = (formato: 'csv' | 'xlsx') => {
    if (rowsToExport.length === 0 || isExporting) return;
    setIsExporting(formato);

    // Deixa o React pintar o estado de "gerando" antes do trabalho pesado.
    setTimeout(async () => {
      try {
        if (formato === 'csv') {
          downloadCsv(rowsToExport, exportFileName);
        } else {
          await downloadXlsx(rowsToExport, exportFileName);
        }
      } catch (err) {
        console.error('Erro ao gerar o arquivo:', err);
      } finally {
        setIsExporting(null);
      }
    }, 0);
  };

  const toggleArrayFilter = (key: 'veiculo' | 'tipoDeCompra' | 'campanha', value: string) => {
    setLocalFilters(prev => {
      const currentArray = prev[key];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  };

  // Objeto de localização customizado para react-date-range
  const localeConfig = useMemo(() => ({
    ...ptBR,
    localize: {
      ...ptBR.localize,
      day: (n: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][n],
      month: (n: number) => [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ][n]
    } as typeof ptBR.localize
  }), []);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-50 transform transition-all duration-300 ease-in-out">
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Filtros</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Período
              </label>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handlePresetClick(subMonths(maxDate, 1), maxDate)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Último mês
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetClick(subMonths(maxDate, 3), maxDate)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Últimos 3 meses
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetClick(startOfYear(new Date()), endOfYear(new Date()))}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Este ano
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetClick(startOfYear(subMonths(new Date(), 12)), endOfYear(subMonths(new Date(), 12)))}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Ano passado
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetClick(minDate, maxDate)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors col-span-2"
                >
                  Todo o período disponível
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg">
                <DateRangePicker
                  ranges={dateRange}
                  onChange={handleDateChange}
                  locale={localeConfig}
                  maxDate={maxDate}
                  minDate={minDate}
                  showMonthAndYearPickers={true}
                  showDateDisplay={false}
                  moveRangeOnFirstSelection={false}
                  rangeColors={['#2563eb']}
                  months={1}
                  direction="horizontal"
                  weekdayDisplayFormat="EEEEEE"
                  monthDisplayFormat="MMMM yyyy"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Campanha
              </label>
              <div className="space-y-2">
                {availableFilters.campanhas.map(campanha => (
                  <label key={campanha} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.campanha.includes(campanha)}
                      onChange={() => toggleArrayFilter('campanha', campanha)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{campanha}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número PI
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localFilters.numeroPi || ''}
                onChange={(e) => {
                  setLocalFilters(prev => ({
                    ...prev,
                    numeroPi: e.target.value || null
                  }));
                }}
              >
                <option value="">Todos</option>
                {filteredNumerosPi.map(numeroPi => (
                  <option key={numeroPi} value={numeroPi}>
                    {numeroPi}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Veículo
              </label>
              <div className="space-y-2">
                {availableFilters.veiculos.map(veiculo => (
                  <label key={veiculo} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.veiculo.includes(veiculo)}
                      onChange={() => toggleArrayFilter('veiculo', veiculo)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{veiculo}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de Compra
              </label>
              <div className="space-y-2">
                {availableFilters.tiposDeCompra.map(tipo => (
                  <label key={tipo} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.tipoDeCompra.includes(tipo)}
                      onChange={() => toggleArrayFilter('tipoDeCompra', tipo)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{tipo}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                {rowsToExport.length === 0
                  ? 'Nenhum dado para baixar'
                  : `Baixar base completa (${rowCountLabel} ${rowsToExport.length === 1 ? 'linha' : 'linhas'})`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={rowsToExport.length === 0 || isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isExporting === 'csv' ? 'Gerando...' : 'CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  disabled={rowsToExport.length === 0 || isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isExporting === 'xlsx' ? 'Gerando...' : 'Excel'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1 border-t border-gray-100">
              <button
                onClick={handleClear}
                className="flex-1 mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Limpar
              </button>
              <button
                onClick={handleApply}
                className="flex-1 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Filters;
