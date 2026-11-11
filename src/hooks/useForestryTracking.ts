import { useState, useEffect, useRef, useCallback } from 'react';
import { db, BreadcrumbRecord } from '../services/db';

const PATROL_WAYPOINTS: [number, number, number, 'Dense' | 'Moderate' | 'Sparse'][] = [
  [47.8021, -123.6044, 480, 'Moderate'],
  [47.8035, -123.6028, 495, 'Dense'],
  [47.8052, -123.6009, 515, 'Dense'],
  [47.8078, -123.5985, 538, 'Dense'],
  [47.8102, -123.5954, 562, 'Moderate'],
  [47.8126, -123.5921, 584, 'Dense'],
  [47.8148, -123.5885, 610, 'Dense'],
  [47.8169, -123.5852, 625, 'Sparse'],
  [47.8185, -123.5821, 640, 'Clear'],
  [47.8172, -123.5794, 630, 'Moderate'],
  [47.8150, -123.5780, 605, 'Dense'],
  [47.8120, -123.5815, 570, 'Dense'],
  [47.8090, -123.5860, 540, 'Dense'],
  [47.8060, -123.5910, 510, 'Moderate'],
  [47.8030, -123.5980, 490, 'Moderate'],
];

export function useForestryTracking() {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<'hardware_gps' | 'simulated_patrol'>('simulated_patrol');
  const [currentPosition, setCurrentPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    altitude: number | null;
    canopyDensity: 'Dense' | 'Moderate' | 'Sparse' | 'Clear';
  }>({
    latitude: 47.8115,
    longitude: -123.5935,
    accuracy: 4.8,
    speed: 1.3,
    altitude: 590,
    canopyDensity: 'Dense',
  });
  const [batteryLevel, setBatteryLevel] = useState<number>(87);
  const [totalRecorded, setTotalRecorded] = useState<number>(0);
  const [lastLoggedAt, setLastLoggedAt] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const simIndexRef = useRef<number>(3);
  const simIntervalRef = useRef<any>(null);

  const refreshTotal = useCallback(async () => {
    try {
      const count = await db.breadcrumbs.count();
      setTotalRecorded(count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshTotal();
  }, [refreshTotal]);

  const recordBreadcrumb = useCallback(
    async (
      coords: {
        latitude: number;
        longitude: number;
        accuracy: number;
        speed?: number | null;
        altitude?: number | null;
        canopyDensity?: 'Dense' | 'Moderate' | 'Sparse' | 'Clear';
      },
      mode: 'hardware_gps' | 'simulated_patrol'
    ) => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const record: Omit<BreadcrumbRecord, 'id'> = {
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
        accuracy: Number(coords.accuracy.toFixed(1)),
        speed: coords.speed != null ? Number(coords.speed.toFixed(2)) : 1.3,
        altitude: coords.altitude != null ? Math.round(coords.altitude) : 520,
        timestamp: new Date().toISOString(),
        synced: isOnline ? 1 : 0,
        rangerId: 'RNGR-07',
        rangerName: 'Ranger Davis (Canopy Unit)',
        canopyDensity: coords.canopyDensity || 'Dense',
        batteryLevel: Math.max(12, batteryLevel - 1),
        mode,
      };

      await db.breadcrumbs.add(record as BreadcrumbRecord);
      setBatteryLevel((prev) => Math.max(15, prev - 0.2));
      setLastLoggedAt(new Date());
      refreshTotal();
    },
    [batteryLevel, refreshTotal]
  );

  const startTracking = useCallback(() => {
    setIsTracking(true);
    setGpsError(null);

    if (trackingMode === 'hardware_gps') {
      if (!('geolocation' in navigator)) {
        setGpsError('Geolocation API not supported on this device/browser.');
        setIsTracking(false);
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          const spd = pos.coords.speed;
          const alt = pos.coords.altitude;
          const density = acc > 15 ? 'Dense' : acc > 8 ? 'Moderate' : 'Clear';

          setCurrentPosition({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            speed: spd,
            altitude: alt,
            canopyDensity: density,
          });

          recordBreadcrumb(
            { latitude: lat, longitude: lng, accuracy: acc, speed: spd, altitude: alt, canopyDensity: density },
            'hardware_gps'
          );
        },
        (err) => {
          console.warn('[GPS Warning]', err.message);
          setGpsError(`${err.message} (Using Simulated Canopy Tracker)`);
          setTrackingMode('simulated_patrol');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
      );
    } else {
      // Simulated Canopy Patrol
      simIntervalRef.current = setInterval(() => {
        simIndexRef.current = (simIndexRef.current + 1) % PATROL_WAYPOINTS.length;
        const [lat, lng, alt, density] = PATROL_WAYPOINTS[simIndexRef.current];

        // Add small jitter for realistic GPS drift in forest canopy
        const jitterLat = lat + (Math.random() - 0.5) * 0.0004;
        const jitterLng = lng + (Math.random() - 0.5) * 0.0004;
        const jitterAcc = density === 'Dense' ? 5.5 + Math.random() * 4 : 2.5 + Math.random() * 2;
        const simSpeed = 1.2 + Math.random() * 0.6;

        setCurrentPosition({
          latitude: jitterLat,
          longitude: jitterLng,
          accuracy: jitterAcc,
          speed: simSpeed,
          altitude: alt,
          canopyDensity: density,
        });

        recordBreadcrumb(
          {
            latitude: jitterLat,
            longitude: jitterLng,
            accuracy: jitterAcc,
            speed: simSpeed,
            altitude: alt,
            canopyDensity: density,
          },
          'simulated_patrol'
        );
      }, 5000);
    }
  }, [trackingMode, recordBreadcrumb]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current !== null) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }, []);

  const triggerSingleBreadcrumb = useCallback(() => {
    simIndexRef.current = (simIndexRef.current + 1) % PATROL_WAYPOINTS.length;
    const [lat, lng, alt, density] = PATROL_WAYPOINTS[simIndexRef.current];
    const jitterLat = lat + (Math.random() - 0.5) * 0.0003;
    const jitterLng = lng + (Math.random() - 0.5) * 0.0003;
    const accuracy = density === 'Dense' ? 6.2 : 3.4;

    setCurrentPosition({
      latitude: jitterLat,
      longitude: jitterLng,
      accuracy,
      speed: 1.4,
      altitude: alt,
      canopyDensity: density,
    });

    recordBreadcrumb(
      {
        latitude: jitterLat,
        longitude: jitterLng,
        accuracy,
        speed: 1.4,
        altitude: alt,
        canopyDensity: density,
      },
      trackingMode
    );
  }, [trackingMode, recordBreadcrumb]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    isTracking,
    trackingMode,
    setTrackingMode,
    currentPosition,
    batteryLevel,
    totalRecorded,
    lastLoggedAt,
    gpsError,
    startTracking,
    stopTracking,
    triggerSingleBreadcrumb,
  };
}
