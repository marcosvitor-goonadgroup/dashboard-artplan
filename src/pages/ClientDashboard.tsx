import { useState, useMemo, useEffect } from 'react';
import { CampaignProvider, useCampaign } from '../contexts/CampaignContext';
import BigNumbers from '../components/BigNumbers';
import ImpressionsChart from '../components/ImpressionsChart';
import VehicleMetrics from '../components/VehicleMetrics';
import ComparisonToggle from '../components/ComparisonToggle';
import AIAnalysis from '../components/AIAnalysis';
import OnDemandAnalysis from '../components/OnDemandAnalysis';
import CreativePerformance from '../components/CreativePerformance';
import CreativeAnalysis from '../components/CreativeAnalysis';
import ParticlesBackground from '../components/ParticlesBackground';
import PIInfoCard from '../components/PIInfoCard';
import Filters from '../components/Filters';
import ClientCampaignList from '../components/ClientCampaignList';
import logoArtplan from '../images/logo-artplan.png';
import { getClientLogo } from '../config/clientLogos';
import { toSlug } from '../utils/slug';
import { subDays } from 'date-fns';

interface ClientHeaderProps {
  clientName: string;
  clientLogo?: string;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
}

const ClientHeader = ({ clientName, clientLogo, onOpenFilters, onClearFilters, activeFiltersCount }: ClientHeaderProps) => (
  <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <a href="/" title="Voltar para a visão da agência">
            <img src={logoArtplan} alt="Artplan" className="h-8 sm:h-12 w-auto shrink-0" />
          </a>
          <div className="border-l border-gray-300 pl-2 sm:pl-4 min-w-0 flex items-center gap-3">
            {clientLogo && (
              <img src={clientLogo} alt={clientName} className="h-8 w-auto max-w-[140px] object-contain shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-bold text-gray-900 truncate">{clientName}</h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Painel de Campanhas</p>
            </div>
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

const ClientDashboardContent = ({ slug }: { slug: string }) => {
  const { loading, error, filteredData, filters, setFilters, data } = useCampaign();

  const clientName = useMemo(
    () => data.find(d => toSlug(d.cliente || '') === slug)?.cliente || slug.toUpperCase(),
    [data, slug]
  );
  const clientLogo = getClientLogo(clientName);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'7days' | 'all'>('7days');
  const [comparisonMode, setComparisonMode] = useState<'benchmark' | 'previous'>('benchmark');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedPI, setSelectedPI] = useState<string | null>(null);

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

  // Todos os dados do cliente (respeitando filtros globais), excluindo o dia atual (D-1)
  const clientData = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    return filteredData.filter(d => toSlug(d.cliente || '') === slug && d.date <= yesterday);
  }, [filteredData, slug]);

  const maxAvailableDate = useMemo(() => {
    if (clientData.length === 0) return subDays(new Date(), 1);
    return new Date(Math.max(...clientData.map(d => d.date.getTime())));
  }, [clientData]);

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
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0
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
        taxaEngajamento: e.imp > 0 ? (e.eng / e.imp) * 100 : 0
      });
    });
    return map;
  }, [data]);

  const displayData = useMemo(() => {
    let d = clientData;
    if (periodFilter === '7days') d = d.filter(i => i.date >= sevenDaysAgoFromMaxDate);
    if (selectedCampaign) d = d.filter(i => i.campanha === selectedCampaign);
    if (selectedVehicle) d = d.filter(i => i.veiculo === selectedVehicle);
    if (selectedPI) d = d.filter(i => i.numeroPi === selectedPI);
    return d;
  }, [clientData, periodFilter, selectedCampaign, selectedVehicle, selectedPI, sevenDaysAgoFromMaxDate]);

  const previousPeriodMetrics = useMemo(() => {
    if (periodFilter !== '7days') return null;
    const fourteenDaysAgo = subDays(maxAvailableDate, 14);
    const prev = clientData.filter(i => i.date >= fourteenDaysAgo && i.date < sevenDaysAgoFromMaxDate);
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
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0
    };
  }, [clientData, periodFilter, maxAvailableDate, sevenDaysAgoFromMaxDate]);

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
      taxaEngajamento: totalImp > 0 ? (totalEng / totalImp) * 100 : 0
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
    if (selectedPI) count++;
    return count;
  }, [filters, selectedVehicle, selectedPI]);

  const handleClearFilters = () => {
    setSelectedCampaign(null);
    setSelectedVehicle(null);
    setSelectedPI(null);
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
        <ClientHeader
          clientName={clientName}
          clientLogo={clientLogo}
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
                filters={filters}
                periodFilter={periodFilter}
                generalBenchmarks={generalBenchmarks}
                comparisonMode={comparisonMode}
                previousPeriodMetrics={previousPeriodMetrics}
                selectedPI={selectedPI}
              />
            </div>

            {selectedPI && (
              <div>
                <PIInfoCard
                  numeroPi={selectedPI}
                  campaignData={clientData.filter(d => d.numeroPi === selectedPI)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch">
              <div className="lg:col-span-4 flex">
                <div className="w-full">
                  <ClientCampaignList
                    data={clientData}
                    selectedPI={selectedPI}
                    onSelectPI={setSelectedPI}
                  />
                </div>
              </div>
              <div className="lg:col-span-8 flex">
                <div className="w-full">
                  <ImpressionsChart
                    data={displayData}
                    allData={clientData}
                    periodFilter={periodFilter}
                    comparisonMode={comparisonMode}
                    showComparison={periodFilter === '7days'}
                    maxAvailableDate={maxAvailableDate}
                    sevenDaysAgoFromMaxDate={sevenDaysAgoFromMaxDate}
                  />
                </div>
              </div>
            </div>

            <div>
              <VehicleMetrics
                data={displayData}
                selectedCampaign={selectedCampaign}
                periodFilter={periodFilter}
                filters={filters}
                vehicleBenchmarks={vehicleBenchmarks}
                selectedVehicle={selectedVehicle}
                onSelectVehicle={setSelectedVehicle}
                selectedPI={selectedPI}
              />
            </div>

            <div>
              <AIAnalysis
                data={displayData}
                allData={clientData}
                periodFilter={periodFilter}
                selectedCampaign={selectedCampaign}
              />
            </div>

            <div>
              <OnDemandAnalysis
                data={displayData}
                allData={clientData}
                periodFilter={periodFilter}
              />
            </div>

            <div>
              <CreativePerformance data={displayData} />
            </div>

            <div>
              <CreativeAnalysis
                data={displayData}
                periodFilter={periodFilter}
                selectedCampaign={selectedCampaign}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const ClientDashboard = ({ slug }: { slug: string }) => (
  <CampaignProvider>
    <ClientDashboardContent slug={slug} />
  </CampaignProvider>
);

export default ClientDashboard;
