import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext';

export function useSite() {
  const { selectedSite, selectedSiteId, setSelectedSiteId } = useUnifiedSiteContext();

  return {
    site: selectedSite,
    siteId: selectedSiteId,
    setSiteId: setSelectedSiteId,
  };
}

export function useSelectedSite() {
  const { selectedSite } = useUnifiedSiteContext();
  return selectedSite;
}

export function useSelectedSiteId() {
  const { selectedSiteId } = useUnifiedSiteContext();
  return selectedSiteId;
}