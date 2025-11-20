import './SiteMap.css';
import dynamic from 'next/dynamic';
import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteService } from '@/services/site.service';
import { Site } from '@/types';

const DynamicSiteMap = () => {
    // Fetch the full site details for the map
    const { data: sites, isLoading, error } = useQuery<Site[], Error>({
        queryKey: ['all-sites-for-map'], // A unique key for this specific query
        queryFn: siteService.getAllSites,
        staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    });

    // Dynamically import SiteMap component.
    // This MUST be called before any conditional returns to respect the Rules of Hooks.
    const SiteMap = useMemo(() => dynamic(() => import('./SiteMap'), {
      loading: () => <p>Loading map component...</p>,
      ssr: false
    }), []);

    // Handle loading and error states for the map's data
    if (isLoading) {
        return <p>Loading map data...</p>;
    }

    if (error) {
        return <p className="text-red-500">Error loading map data: {error.message}</p>;
    }

    // Ensure sites data is available before rendering SiteMap
    if (!sites) {
        return <p>No site data available.</p>;
    }
  
    return <SiteMap sites={sites} />;
  };
  
  export default DynamicSiteMap;

  