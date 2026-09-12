import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { LonLat, MapView, Point, Size, ZoomTier } from './projection';
import { tierFor } from './projection';

export interface MapRenderProps {
  project: (lonLat: LonLat) => Point;
  size: Size;
  tier: ZoomTier;
  zoom: number;
}

interface Props {
  view: MapView;
  onViewChange: (view: MapView) => void;
  onBackgroundTap?: () => void;
  children?: (props: MapRenderProps) => React.ReactNode;
}

export function MapSurface(props: Props) {
  const globeRef = useRef<any>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // סנכרון המצלמה ומתן אפשרות לזום קרוב מאוד (Altitude נמוך)
  useEffect(() => {
    if (globeRef.current) {
      const [lng, lat] = props.view.center;
      // התאמת גובה המצלמה כך שזום גבוה יביא אותך ממש אל פני הקרקע (לרמת ערים ורחובות)
      const altitude = Math.max(0.005, 3.5 / Math.pow(1.5, (props.view.zoom || 2) - 2));
      globeRef.current.pointOfView({ lat, lng, altitude }, 1200);
    }
  }, [props.view.center, props.view.zoom]);

  const size = windowSize;
  const zoom = props.view.zoom || 2;
  const tier = tierFor(zoom);
  const project = (_lonLat: LonLat): Point => ({ x: 0, y: 0 });

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#0a0f18', overflow: 'hidden', zIndex: 0 }}>
      <Globe
        ref={globeRef}
        // מעבר אוטומטי למפת לוויין מפורטת של Esri בזום קרוב, או מרקם כדור ארץ מרחוק
        globeImageUrl={zoom > 4 ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/9" : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"}
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        onGlobeClick={() => props.onBackgroundTap?.()}
        width={windowSize.width}
        height={windowSize.height}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        {props.children?.({ project, size, tier, zoom })}
      </div>
    </div>
  );
}