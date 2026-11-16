/**
 * Imagens de criativo.
 *
 * A fonte principal é a coluna "Image" da própria planilha de entrega. Este
 * módulo cobre só o caso em que o criativo não tem URL na planilha e a imagem
 * precisa vir de um mapa manual.
 *
 * A varredura de criativos numa pasta do Google Drive foi removida junto com a
 * base da agência anterior; ao configurar `CREATIVE_DRIVE_FOLDER_ID` para a
 * Lola, essa parte pode voltar.
 */

/**
 * Mapeamento estático de fallback: padrão de nome (substring, sem caixa) → URL.
 *
 * Ex.: { pattern: 'criativo-crise-hidrica-mrec', url: 'https://...' }
 */
const STATIC_IMAGE_FALLBACKS: Array<{ pattern: string; url: string }> = [];

/**
 * Retorna URL de fallback estático para um criativo pelo nome.
 * Procura por correspondência de substring (case-insensitive).
 */
export const getFallbackImageUrl = (creativeName: string): string | null => {
  const lowerName = creativeName.toLowerCase();
  for (const entry of STATIC_IMAGE_FALLBACKS) {
    if (lowerName.includes(entry.pattern.toLowerCase())) {
      return entry.url;
    }
  }
  return null;
};
