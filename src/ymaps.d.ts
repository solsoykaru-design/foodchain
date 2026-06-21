declare const ymaps: {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: { center: number[]; zoom: number; controls?: string[] }) => {
    destroy: () => void;
    setBounds: (bounds: [[number, number], [number, number]], options?: { checkZoomRange?: boolean; zoomMargin?: number }) => void;
    geoObjects: {
      add: (obj: unknown) => void;
    };
  };
  Placemark: new (coords: number[], properties?: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
  Polyline: new (coords: number[][], properties?: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
};
