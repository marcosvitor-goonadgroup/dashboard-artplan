import logoMoovit from '../images/Moovit_Logo.png';
import { toSlug } from '../utils/slug';

// Veículos representados por uma logo em imagem no lugar do ícone vetorial
// padrão (ver SocialIcon em VehicleMetrics). O slug absorve as variações de
// caixa entre a planilha de PI ("MOOVIT") e o Consolidado ("Moovit").
const logosBySlug: Record<string, string> = {
  [toSlug('Moovit')]: logoMoovit
};

export const getVehicleLogo = (name: string): string | undefined =>
  logosBySlug[toSlug(name || '')];
