import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { LatLngExpression, divIcon } from 'leaflet';
import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext';
import { Site } from '@/types';
import L from 'leaflet';
import { Button } from "@/components/ui/button";

// Fix for default marker icon
const icon = L.icon({
  iconUrl: "/images/markers/black-marker.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "/images/markers/marker-shadow.png", // Assuming a generic shadow is provided locally
  shadowSize: [41, 41],
});

// Custom icon creation function for clusters
const createClusterCustomIcon = (cluster: any) => {
  return divIcon({
    html: `<span>${cluster.getChildCount()}</span>`,
    className: 'marker-cluster-custom',
    iconSize: [40, 40],
  });
};

interface SiteMapProps {
  sites: Site[];
}

const ChangeView = ({ center, zoom }: { center: LatLngExpression; zoom: number }) => {
  const map = useMap();
  map.setView(center, zoom);
  return null;
};

const SiteMap = ({ sites }: SiteMapProps) => { // sites is now correctly Site[]
  const { selectedSiteId, setSelectedSiteId } = useUnifiedSiteContext();

  // Find the full Site object from the 'sites' prop using selectedSiteId
  const currentSelectedSite = sites.find(site => site.id === selectedSiteId);

  const center: LatLngExpression = currentSelectedSite
    ? [parseFloat(currentSelectedSite.latitude), parseFloat(currentSelectedSite.longitude)]
    : [41.902782, 12.496366]; // Default to Rome if no site is selected
  const zoom = currentSelectedSite ? 13 : 5;

  const handleSelectSite = (siteId: number) => {
    setSelectedSiteId(siteId);
  };

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} className="site-map">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <ChangeView center={center} zoom={zoom} />
      <MarkerClusterGroup
        iconCreateFunction={createClusterCustomIcon}
        showCoverageOnHover={true}
      >
        {sites.map(site => (
          site.latitude && site.longitude && (
            <Marker key={site.id} position={[parseFloat(site.latitude), parseFloat(site.longitude)]} icon={icon}>
              <Popup>
                <div className="flex flex-col space-y-2">
                  <div className="text-center">
                    <b className="text-lg">{site.name}</b><br />
                    <span className="text-sm text-gray-500">{site.customer_name}</span>
                  </div>
                  <Button onClick={() => handleSelectSite(site.id)} size="sm" className="w-full">
                    Mostra
                  </Button>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
};

export default SiteMap;

