import { useState, useMemo, useEffect } from 'react';
import { CampaignProvider, useCampaign } from '../contexts/CampaignContext';
import BigNumbers from '../components/BigNumbers';
import ImpressionsChart from '../components/ImpressionsChart';
import VehicleMetrics from '../components/VehicleMetrics';
import ComparisonToggle from '../components/ComparisonToggle';
import PIInfoCard from '../components/PIInfoCard';
import CreativePerformance from '../components/CreativePerformance';
import Filters from '../components/Filters';
import ParticlesBackground from '../components/ParticlesBackground';
import logoArtplan from '../images/logo-artplan.png';
import { subDays } from 'date-fns';
import { toSlug } from '../utils/slug';

interface PIDashboardProps {
  clientSlug: string;
  campaignSlug: string;
  piSlug: string;
}

const PIHeader = ({
  clientName,
  clientSlug,
  campaignName,
  campaignSlug,
  piNumber,
  onOpenFilters,
  onClearFilters,
  activeFiltersCount,
}: {
  clientName: string;
  clientSlug: string;
  campaignName: string;
  campaignSlug: string;
  piNumber: string;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
}) => (
  <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <a href="/" title="Voltar para a visão da agência">
            <img src={logoArtplan} alt="Artplan" className="h-8 sm:h-12 w-auto shrink-0" />
          </a>
          <div className="border-l border-gray-300 pl-2 sm:pl-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`/${clientSlug}`} className="text-xs text-gray-500 hover:text-blue-600 font-medium">{clientName}</a>
              <span className="text-gray-300 text-xs">/</span>
              <a href={`/${clientSlug}/${campaignSlug}`} className="text-xs text-gray-500 hover:text-blue-600 font-medium truncate max-w-[200px]">{campaignName}</a>
              <span className="text-gray-300 text-xs">/</span>
              <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">PI {piNumber}</h1>
            </div>
            <p className="text-xs text-gray-500 hidden sm:block mt-0.5">Painel de Campanhas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
              title="Limpar filtros"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={onOpenFilters}
            className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  </header>
);

const PIDashboardContent = ({ clientSlug, campaignSlug, piSlug }: PIDashboardProps) => {
  const { loading, error, filteredData, filters, setFilters, data } = useCampaign();

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'7days' | 'all'>('7days');
  const [comparisonMode, setComparisonMode] = useState<'benchmark' | 'previous'>('benchmark');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  useEffect(() => {
    setFilters({
      dateRange: { start: null, end: null },
      veiculo: [],
      tipoDeCompra: [],
      campanha: [],
      numeroPi: null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientName = useMemo(
    () => data.find(d => toSlug(d.cliente || '') === clientSlug)?.cliente || clientSlug.toUpperCase(),
    [data, clientSlug]
  );

  const campaignName = useMemo(() => {
    const found = data.find(
      d => toSlug(d.cliente || '') === clientSlug && toSlug(d.campanha || '') === campaignSlug
    );
    return found?.campanha || campaignSlug;
  }, [data, clientSlug, campaignSlug]);

  // Dados deste PI (respeitando filtros globais), excluindo o dia atual (D-1)
  const piData = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    return filteredData.filter(
      d =>
        toSlug(d.cliente || '') === clientSlug &&
        toSlug(d.campanha || '') === campaignSlug &&
        d.numeroPi === piSlug &&
        d.date <= yesterday
    );
  }, [filteredData, clientSlug, campaignSlug, piSlug]);

  const maxAvailableDate = useMemo(() => {
    if (piData.length === 0) return subDays(new Date(), 1);
    return new Date(Math.max(...piData.map(d => d.date.getTime())));
  }, [piData]);

  const sevenDaysAgoFromMaxDate = useMemo(
    () => subDays(maxAvailableDate, 7),
    [maxAvailableDate]
  );

  const generalBenchmarks = useMemo(() => {
    const totalImp = data.reduce((s, i) => s + i.impressions, 0);
    const totalClk = data.reduce((s, i) => s + i.clicks, 0);
    const totalVid = data.reduce((s, i) => s + i.videoCompletions, 0);
    const totalEng = data.reduce((s, i) => s + i.totalEngagements, 0);
    return {
      ctr: totalImp > 0 ? (totalClk / totalImp) * 100 : 0,
      vtr: totalImp > 0 ? (totalVid / totalImp) * 100 : 0,
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0,
    };
  }, [data]);

  const vehicleBenchmarks = useMemo(() => {
    const map = new Map<string, { ctr: number; vtr: number; taxaEngajamento: number }>();
    const vMap = new Map<string, { imp: number; clk: number; vid: number; eng: number }>();
    data.forEach(item => {
      if (!item.veiculo) return;
      const e = vMap.get(item.veiculo) ?? { imp: 0, clk: 0, vid: 0, eng: 0 };
      e.imp += item.impressions; e.clk += item.clicks;
      e.vid += item.videoCompletions; e.eng += item.totalEngagements;
      vMap.set(item.veiculo, e);
    });
    vMap.forEach((e, v) => {
      map.set(v, {
        ctr: e.imp > 0 ? (e.clk / e.imp) * 100 : 0,
        vtr: e.imp > 0 ? (e.vid / e.imp) * 100 : 0,
        taxaEngajamento: e.imp > 0 ? (e.eng / e.imp) * 100 : 0,
      });
    });
    return map;
  }, [data]);

  const displayData = useMemo(() => {
    let d = piData;
    if (periodFilter === '7days') d = d.filter(i => i.date >= sevenDaysAgoFromMaxDate);
    if (selectedVehicle) d = d.filter(i => i.veiculo === selectedVehicle);
    return d;
  }, [piData, periodFilter, sevenDaysAgoFromMaxDate, selectedVehicle]);

  const previousPeriodMetrics = useMemo(() => {
    if (periodFilter !== '7days') return null;
    const fourteenDaysAgo = subDays(maxAvailableDate, 14);
    const prev = piData.filter(i => i.date >= fourteenDaysAgo && i.date < sevenDaysAgoFromMaxDate);
    const totalInv = prev.reduce((s, i) => s + i.cost, 0);
    const totalImp = prev.reduce((s, i) => s + i.impressions, 0);
    const totalClk = prev.reduce((s, i) => s + i.clicks, 0);
    const totalVid = prev.reduce((s, i) => s + i.videoViews, 0);
    const totalEng = prev.reduce((s, i) => s + i.totalEngagements, 0);
    const totalVidC = prev.reduce((s, i) => s + i.videoCompletions, 0);
    return {
      investimento: totalInv, investimentoReal: totalInv,
      impressoes: totalImp, cliques: totalClk, views: totalVid, engajamento: totalEng,
      cpm: totalImp > 0 ? (totalInv / totalImp) * 1000 : 0,
      cpc: totalClk > 0 ? totalInv / totalClk : 0,
      cpv: totalVid > 0 ? totalInv / totalVid : 0,
      cpe: totalEng > 0 ? totalInv / totalEng : 0,
      ctr: totalImp > 0 ? (totalClk / totalImp) * 100 : 0,
      vtr: totalImp > 0 ? (totalVidC / totalImp) * 100 : 0,
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0,
    };
  }, [piData, periodFilter, maxAvailableDate, sevenDaysAgoFromMaxDate]);

  const displayMetrics = useMemo(() => {
    const totalInv = displayData.reduce((s, i) => s + i.cost, 0);
    const totalImp = displayData.reduce((s, i) => s + i.impressions, 0);
    const totalClk = displayData.reduce((s, i) => s + i.clicks, 0);
    const totalVid = displayData.reduce((s, i) => s + i.videoViews, 0);
    const totalEng = displayData.reduce((s, i) => s + i.totalEngagements, 0);
    const totalVidC = displayData.reduce((s, i) => s + i.videoCompletions, 0);
    return {
      investimento: totalInv, investimentoReal: totalInv,
      impressoes: totalImp, cliques: totalClk, views: totalVid, engajamento: totalEng,
      cpm: totalImp > 0 ? (totalInv / totalImp) * 1000 : 0,
      cpc: totalClk > 0 ? totalInv / totalClk : 0,
      cpv: totalVid > 0 ? totalInv / totalVid : 0,
      cpe: totalEng > 0 ? totalInv / totalEng : 0,
      ctr: totalImp > 0 ? (totalClk / totalImp) * 100 : 0,
      vtr: totalImp > 0 ? (totalVidC / totalImp) * 100 : 0,
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0,
    };
  }, [displayData]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.veiculo.length > 0) count += filters.veiculo.length;
    if (filters.tipoDeCompra.length > 0) count += filters.tipoDeCompra.length;
    if (filters.campanha.length > 0) count += filters.campanha.length;
    if (filters.numeroPi) count++;
    if (selectedVehicle) count++;
    return count;
  }, [filters, selectedVehicle]);

  const handleClearFilters = () => {
    setSelectedVehicle(null);
    setFilters({
      dateRange: { start: null, end: null },
      veiculo: [],
      tipoDeCompra: [],
      campanha: [],
      numeroPi: null
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <ParticlesBackground />
      <div className="relative z-10">
        <PIHeader
          clientName={clientName}
          clientSlug={clientSlug}
          campaignName={campaignName}
          campaignSlug={campaignSlug}
          piNumber={piSlug}
          onOpenFilters={() => setIsFiltersOpen(true)}
          onClearFilters={handleClearFilters}
          activeFiltersCount={activeFiltersCount}
        />
        <Filters isOpen={isFiltersOpen} onClose={() => setIsFiltersOpen(false)} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                <h2 className="text-xs sm:text-sm font-medium text-gray-600">Resultados</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      onClick={() => setPeriodFilter('7days')}
                      className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
                        periodFilter === '7days'
                          ? 'bg-green-600 text-white shadow-md hover:bg-green-700'
                          : 'bg-white/60 backdrop-blur-md text-gray-700 border border-gray-200/50 hover:bg-white/80'
                      }`}
                    >
                      <span className="hidden sm:inline">Últimos 7 dias</span>
                      <span className="sm:hidden">7 dias</span>
                    </button>
                    <button
                      onClick={() => setPeriodFilter('all')}
                      className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
                        periodFilter === 'all'
                          ? 'bg-green-600 text-white shadow-md hover:bg-green-700'
                          : 'bg-white/60 backdrop-blur-md text-gray-700 border border-gray-200/50 hover:bg-white/80'
                      }`}
                    >
                      <span className="hidden sm:inline">Todo o período</span>
                      <span className="sm:hidden">Tudo</span>
                    </button>
                  </div>
                  {periodFilter === '7days' && (
                    <>
                      <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
                      <ComparisonToggle comparisonMode={comparisonMode} onModeChange={setComparisonMode} />
                    </>
                  )}
                </div>
              </div>
              <BigNumbers
                metrics={displayMetrics}
                periodFilter={periodFilter}
                generalBenchmarks={generalBenchmarks}
                comparisonMode={comparisonMode}
                previousPeriodMetrics={previousPeriodMetrics}
                selectedPI={piSlug}
              />
            </div>

            <div>
              <PIInfoCard numeroPi={piSlug} campaignData={piData} defaultExpanded />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="h-[420px]">
                <ImpressionsChart
                  data={displayData}
                  allData={piData}
                  periodFilter={periodFilter}
                  comparisonMode={comparisonMode}
                  showComparison={periodFilter === '7days'}
                  maxAvailableDate={maxAvailableDate}
                  sevenDaysAgoFromMaxDate={sevenDaysAgoFromMaxDate}
                />
              </div>
            </div>

            <div>
              <VehicleMetrics
                data={displayData}
                selectedCampaign={null}
                periodFilter={periodFilter}
                vehicleBenchmarks={vehicleBenchmarks}
                selectedVehicle={selectedVehicle}
                onSelectVehicle={setSelectedVehicle}
                selectedPI={piSlug}
              />
            </div>

            <div>
              <CreativePerformance data={displayData} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const PIDashboard = ({ clientSlug, campaignSlug, piSlug }: PIDashboardProps) => (
  <CampaignProvider>
    <PIDashboardContent clientSlug={clientSlug} campaignSlug={campaignSlug} piSlug={piSlug} />
  </CampaignProvider>
);

export default PIDashboard;
