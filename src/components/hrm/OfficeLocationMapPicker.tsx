"use client";

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

interface OfficeLocationMapPickerProps {
  center: LatLngExpression;
  zoom: number;
  radius: number;
  markerPosition: LatLngExpression | null;
  onLocationChange: (lat: number, lng: number) => void;
  onMarkerDrag: (lat: number, lng: number) => void;
}

export function OfficeLocationMapPicker({
  center,
  zoom,
  radius,
  markerPosition,
  onLocationChange,
  onMarkerDrag,
}: OfficeLocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;

  // Initialize Map Once with clean teardown
  useEffect(() => {
    if (!containerRef.current) return;

    if ((containerRef.current as any)._leaflet_id) {
      (containerRef.current as any)._leaflet_id = null;
    }

    const initialCenter = markerPosition || center;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom,
      scrollWheelZoom: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    mapRef.current = map;

    return () => {
      clearTimeout(timer);
      try {
        map.remove();
      } catch (err) {
        console.warn('Leaflet cleanup notice:', err);
      }
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Synchronize Marker & Circle when markerPosition or radius updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!markerPosition) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
      return;
    }

    // Update or create Marker
    if (markerRef.current) {
      markerRef.current.setLatLng(markerPosition);
    } else {
      const marker = L.marker(markerPosition, { draggable: true }).addTo(map);
      marker.on('dragend', (e: L.LeafletEvent) => {
        const target = e.target as L.Marker;
        const latlng = target.getLatLng();
        onMarkerDragRef.current(latlng.lat, latlng.lng);
      });
      markerRef.current = marker;
    }

    // Update or create Circle
    if (circleRef.current) {
      circleRef.current.setLatLng(markerPosition);
      circleRef.current.setRadius(radius);
    } else {
      const circle = L.circle(markerPosition, {
        radius,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(map);
      circleRef.current = circle;
    }

    // Pan map to position
    map.setView(markerPosition, Math.max(map.getZoom(), 15));
  }, [markerPosition, radius]);

  return (
    <div
      ref={containerRef}
      className="h-[300px] w-full rounded-md overflow-hidden border z-0 relative"
      style={{ height: '300px', width: '100%' }}
    />
  );
}

export default OfficeLocationMapPicker;
