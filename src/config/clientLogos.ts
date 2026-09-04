import logoSenai from '../images/Logo-SENAI.png';
import logoSesi from '../images/sesi_logo.jpg';
import logoMundial from '../images/supermecado_mundial_logo.jpg';
import { toSlug } from '../utils/slug';

// Mapeia logos por slug do nome (case/acento-insensível) para casar com o
// roteamento por slug usado nos dashboards.
const logosBySlug: Record<string, string> = {
  [toSlug('SENAI')]: logoSenai,
  [toSlug('SESI')]: logoSesi,
  [toSlug('SUPERMERCADOS MUNDIAL')]: logoMundial
};

export const getClientLogo = (name: string): string | undefined =>
  logosBySlug[toSlug(name || '')];
