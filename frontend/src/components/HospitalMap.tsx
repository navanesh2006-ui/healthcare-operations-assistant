import React from 'react';
import { Provider } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, AlertCircle, Navigation, Phone, ExternalLink } from 'lucide-react';

interface HospitalMapProps {
  hospital: Provider;
}

export const HospitalMap: React.FC<HospitalMapProps> = ({ hospital }) => {
  const { t } = useLanguage();

  const lat = hospital.latitude || 13.0827;
  const lng = hospital.longitude || 80.2707;

  const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat},${lng}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + hospital.address + ' ' + hospital.district)}`;

  return (
    <div className="bg-darkBg/90 border border-forestGreen/80 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <MapPin className="w-5 h-5 text-limeAccent" />
          {hospital.name}
        </h3>
        <span className="text-[10px] font-semibold bg-forestGreen text-limeAccent border border-primaryGreen/30 px-2 py-0.5 rounded">
          {hospital.facility_type}
        </span>
      </div>

      {/* Mandatory Data-Quality Warnings */}
      <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-lg text-xs text-amber-200 mb-4 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {t('approximateLocationWarning')}
        </div>
        <p className="text-[11px] text-amber-200/80">
          {t('directoryDateWarning')}
        </p>
      </div>

      <div className="text-xs text-textLight/80 space-y-1 mb-4 bg-forestGreen/20 p-3 rounded-lg border border-forestGreen/40">
        <div><strong>Address:</strong> {hospital.address || 'Address not listed'}, {hospital.district}, Tamil Nadu - {hospital.pincode}</div>
        <div><strong>Ownership:</strong> {hospital.ownership} | <strong>Medicine System:</strong> {hospital.systems_of_medicine}</div>
        {hospital.distance_km !== undefined && (
          <div className="text-limeAccent font-bold">Approx. Distance: {hospital.distance_km} km</div>
        )}
      </div>

      {/* Embedded Map Tile Simulation */}
      <div className="relative w-full h-48 bg-panelBg rounded-lg overflow-hidden border border-forestGreen flex items-center justify-center mb-4">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 filter contrast-125"
          style={{ backgroundImage: `url('https://tile.openstreetmap.org/13/5915/3790.png')` }}
        />
        <div className="relative z-10 text-center bg-darkBg/80 p-3 rounded-xl border border-primaryGreen/60 backdrop-blur-sm">
          <MapPin className="w-8 h-8 text-limeAccent animate-bounce mx-auto mb-1" />
          <div className="text-xs font-bold text-white">{hospital.name}</div>
          <div className="text-[10px] text-textLight/70">{lat.toFixed(4)}, {lng.toFixed(4)} (Approximate)</div>
        </div>
      </div>

      {/* Start Travel Action Buttons */}
      <div className="flex items-center gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition shadow"
        >
          <Navigation className="w-4 h-4" />
          Start Travel (Maps)
        </a>
        <a
          href={osmDirectionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-forestGreen hover:bg-forestGreen/80 text-white font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1 border border-primaryGreen/40 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          OSM Route
        </a>
      </div>
    </div>
  );
};
