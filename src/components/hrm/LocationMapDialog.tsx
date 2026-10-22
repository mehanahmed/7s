"use client";

import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import "leaflet-defaulticon-compatibility";

interface LocationInfo {
  lat: number;
  lng: number;
  employeeName: string;
  employeeAvatar?: string;
}

interface LocationMapDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  location: LocationInfo | null;
  title?: string;
}

export function LocationMapDialog({ isOpen, onOpenChange, location, title }: LocationMapDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!isOpen || !location || !containerRef.current) return;

    if ((containerRef.current as any)._leaflet_id) {
      (containerRef.current as any)._leaflet_id = null;
    }

    const map = L.map(containerRef.current, {
      center: [location.lat, location.lng],
      zoom: 15,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const marker = L.marker([location.lat, location.lng]).addTo(map);
    marker.bindPopup(`<b>${location.employeeName}</b><br/>Attendance Location`).openPopup();

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
    };
  }, [isOpen, location]);

  if (!isOpen || !location) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{title || `Attendance Location for ${location.employeeName}`}</DialogTitle>
        </DialogHeader>
        <div
          ref={containerRef}
          style={{ height: '50vh', width: '100%' }}
          className="rounded-b-lg z-0 relative"
        />
      </DialogContent>
    </Dialog>
  );
}

export default LocationMapDialog;
