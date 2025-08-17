import React, { useRef, useEffect } from 'react';

const MapContainer = ({ onMapReady }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && onMapReady) {
      onMapReady(mapRef.current);
    }
  }, [onMapReady]);

  return (
    <div ref={mapRef} id="map" className="h-screen w-full" />
  );
};

export default MapContainer;
