import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

let $3Dmol: any = (window as any).$3Dmol;
let loadingPromise: Promise<any> | null = null;
function load3Dmol(): Promise<any> {
  if ($3Dmol) return Promise.resolve($3Dmol);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://3Dmol.org/build/3Dmol-min.js';
    script.async = true;
    script.onload = () => {
      $3Dmol = (window as any).$3Dmol;
      resolve($3Dmol);
    };
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export default function Molecule3DPopout({ name, smiles, cid, onClose }: { name?: string; smiles?: string; cid?: string | number; onClose: () => void; }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 80, top: 80 });
  const [size, setSize] = useState({ width: 640, height: 480 });

  // Drag handlers
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const header = el.querySelector('.popout-header') as HTMLElement | null;
    if (!header) return;

    function onDown(e: MouseEvent) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = pos.left;
      startTop = pos.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setPos({ left: Math.max(10, startLeft + dx), top: Math.max(10, startTop + dy) });
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    header.addEventListener('mousedown', onDown);
    return () => header.removeEventListener('mousedown', onDown);
  }, [pos.left, pos.top]);

  // Resize handler (bottom-right handle)
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handle = el.querySelector('.resize-handle') as HTMLElement | null;
    if (!handle) return;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    function onDown(e: MouseEvent) {
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = size.width;
      startH = size.height;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    function onMove(e: MouseEvent) {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setSize({ width: Math.max(240, startW + dx), height: Math.max(180, startH + dy) });
    }
    function onUp() {
      resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    handle.addEventListener('mousedown', onDown);
    return () => handle.removeEventListener('mousedown', onDown);
  }, [size.width, size.height]);

  // Fetch SDF and init viewer
  useEffect(() => {
    let cancelled = false;
    async function fetchSDF() {
      // try cid, then name, then smiles for 3d
      const tryUrls = [] as string[];
      if (cid) tryUrls.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`);
      if (name) tryUrls.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/SDF?record_type=3d`);
      if (smiles) tryUrls.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`);
      for (const url of tryUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.text();
        } catch (e) {}
      }
      // fallbacks (2d)
      for (const url of tryUrls) {
        try {
          const res = await fetch(url.replace('3d', '2d'));
          if (res.ok) return await res.text();
        } catch (e) {}
      }
      return null;
    }

    async function init() {
      const lib = await load3Dmol();
      if (cancelled) return;
      const sdf = await fetchSDF();
      if (cancelled) return;
      if (!sdf) return;
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const viewer = lib.createViewer(containerRef.current, { backgroundColor: 'white', antialias: true });
      viewer.addModel(sdf, 'sdf');
      viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: 'Jmol' } });
      viewer.zoomTo();
      viewer.render();
      viewer.spin('y', 0.6);
      viewerRef.current = viewer;
    }

    init();
    return () => {
      cancelled = true;
      if (viewerRef.current) try { viewerRef.current.clear(); } catch {};
    };
  }, [name, smiles, cid]);

  useEffect(() => { if (viewerRef.current) viewerRef.current.resize(); }, [size.width, size.height]);

  // render overlay in portal
  return ReactDOM.createPortal(
    <div ref={overlayRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: size.width, height: size.height, zIndex: 9999, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
      <div className="bg-white border border-border rounded-lg overflow-hidden flex flex-col" style={{height: '100%'}}>
        <div className="popout-header flex items-center justify-between px-3 py-2 bg-violet-50 border-b cursor-move">
          <div className="text-sm font-semibold text-violet-700">3D Viewer — {name}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-violet-50"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div style={{flex: 1, minHeight: 120, position: 'relative'}}>
          <div ref={containerRef} style={{width: '100%', height: '100%'}} />
        </div>
        <div className="resize-handle" style={{width: 14, height: 14, position: 'absolute', right: 6, bottom: 6, cursor: 'nwse-resize', borderRadius: 3, background: 'rgba(0,0,0,0.08)'}} />
      </div>
    </div>,
    document.body
  );
}
