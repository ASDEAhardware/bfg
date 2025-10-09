import { useSiteContext } from '@/contexts/SiteContext';

export function useSite() {
  const { selectedSite, selectedSiteId, setSelectedSiteId } = useSiteContext();

  return {
    site: selectedSite,
    siteId: selectedSiteId,
    setSiteId: setSelectedSiteId,
  };
}

export function useSelectedSite() {
  const { selectedSite } = useSiteContext();
  return selectedSite;
}

export function useSelectedSiteId() {
  const { selectedSiteId } = useSiteContext();
  return selectedSiteId;
}