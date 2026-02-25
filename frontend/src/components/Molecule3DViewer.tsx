import React, { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, Maximize2, Minimize2, Eye, Atom } from "lucide-react";
import Molecule3DPopout from './Molecule3DPopout';

/**
 * Molecule3DViewer — renders an interactive 3D molecular structure
 * using 3Dmol.js loaded from CDN. Fetches 3D conformers from PubChem
 * via the molecule name or SMILES string.
 */

// Dynamically load 3Dmol.js from CDN (only once)
let $3Dmol: any = (window as any).$3Dmol;
let loadingPromise: Promise<any> | null = null;

function load3Dmol(): Promise<any> {
  if ($3Dmol) return Promise.resolve($3Dmol);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://3Dmol.org/build/3Dmol-min.js";
    script.async = true;
    script.onload = () => {
      $3Dmol = (window as any).$3Dmol;
      resolve($3Dmol);
    };
    script.onerror = () => reject(new Error("Failed to load 3Dmol.js"));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

interface Molecule3DViewerProps {
  name: string;
  smiles?: string;
  cid?: number | string;
  height?: number;
  className?: string;
}

type ViewStyle = "stick" | "sphere" | "ball-and-stick" | "cartoon";

export default function Molecule3DViewer({
  name,
  smiles,
  cid,
  height = 280,
  className = "",
}: Molecule3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [viewStyle, setViewStyle] = useState<ViewStyle>("stick");
  const [expanded, setExpanded] = useState(false);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [spinning, setSpinning] = useState(true);

  // Fetch SDF from PubChem
  const fetchSDF = useCallback(async (): Promise<string | null> => {
    // Try by CID first
    if (cid) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
        );
        if (res.ok) return await res.text();
      } catch {}
    }

    // Try by name
    if (name) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/SDF?record_type=3d`
        );
        if (res.ok) return await res.text();
      } catch {}
    }

    // Try by SMILES
    if (smiles) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`
        );
        if (res.ok) return await res.text();
      } catch {}
    }

    // Fallback: 2D SDF (better than nothing)
    if (name) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/SDF?record_type=2d`
        );
        if (res.ok) return await res.text();
      } catch {}
    }
    if (smiles) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=2d`
        );
        if (res.ok) return await res.text();
      } catch {}
    }

    return null;
  }, [name, smiles, cid]);

  const applyStyle = useCallback(
    (viewer: any, style: ViewStyle) => {
      if (!viewer) return;
      viewer.removeAllModels();
      // Re-add model from stored data
      const data = viewer._molData;
      if (!data) return;
      const model = viewer.addModel(data, "sdf");

      switch (style) {
        case "stick":
          viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: "Jmol" } });
          break;
        case "sphere":
          viewer.setStyle({}, { sphere: { scale: 0.3, colorscheme: "Jmol" } });
          break;
        case "ball-and-stick":
          viewer.setStyle(
            {},
            {
              stick: { radius: 0.1, colorscheme: "Jmol" },
              sphere: { scale: 0.22, colorscheme: "Jmol" },
            }
          );
          break;
        case "cartoon":
          viewer.setStyle(
            {},
            {
              stick: { radius: 0.12, colorscheme: "Jmol" },
              sphere: { scale: 0.18, colorscheme: "Jmol" },
            }
          );
          // Add surface with transparency
          viewer.addSurface(
            (window as any).$3Dmol?.SurfaceType?.VDW ?? 1,
            { opacity: 0.15, color: "white" },
            {}
          );
          break;
      }

      viewer.zoomTo();
      viewer.render();
    },
    []
  );

  // Initialize viewer
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      setErrorMsg("");

      try {
        const lib = await load3Dmol();
        if (cancelled || !containerRef.current) return;

        // Fetch molecular data
        const sdf = await fetchSDF();
        if (cancelled) return;

        if (!sdf) {
          setStatus("error");
          setErrorMsg("Could not fetch 3D structure from PubChem.");
          return;
        }

        // Clear container
        containerRef.current.innerHTML = "";

        const viewer = lib.createViewer(containerRef.current, {
          backgroundColor: "white",
          antialias: true,
          cartoonQuality: 10,
        });

        // Store data for style switching
        viewer._molData = sdf;
        viewer.addModel(sdf, "sdf");

        // Default style: stick with Jmol coloring
        viewer.setStyle(
          {},
          { stick: { radius: 0.15, colorscheme: "Jmol" } }
        );
        viewer.zoomTo();
        viewer.render();

        // Auto-spin
        viewer.spin("y", 0.6);

        viewerRef.current = viewer;
        setStatus("ready");
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err.message || "Failed to render 3D structure.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        try {
          viewerRef.current.clear();
        } catch {}
        viewerRef.current = null;
      }
    };
  }, [name, smiles, cid, fetchSDF]);

  // Handle style changes
  useEffect(() => {
    if (viewerRef.current && status === "ready") {
      applyStyle(viewerRef.current, viewStyle);
      if (spinning) viewerRef.current.spin("y", 0.6);
    }
  }, [viewStyle, status, applyStyle, spinning]);

  // Handle spin toggle
  const toggleSpin = useCallback(() => {
    setSpinning((s) => {
      if (viewerRef.current) {
        if (s) viewerRef.current.spin(false);
        else viewerRef.current.spin("y", 0.6);
      }
      return !s;
    });
  }, []);

  // Handle reset camera
  const resetCamera = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  }, []);

  // Handle expanded resize
  useEffect(() => {
    if (viewerRef.current) {
      setTimeout(() => {
        viewerRef.current.resize();
        viewerRef.current.render();
      }, 100);
    }
  }, [expanded]);

  const actualHeight = expanded ? Math.min(500, window.innerHeight * 0.5) : height;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border/50 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-border/30">
        <span className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
          <Atom className="h-3.5 w-3.5" />
          3D Molecular Structure
        </span>
        <div className="flex items-center gap-1">
          {/* View style selector */}
          {status === "ready" && (
            <>
              {(["stick", "ball-and-stick", "sphere", "cartoon"] as ViewStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setViewStyle(s)}
                  className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-all ${
                    viewStyle === s
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-violet-600 hover:bg-violet-100"
                  }`}
                >
                  {s === "ball-and-stick" ? "B&S" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div className="w-px h-4 bg-border/40 mx-1" />
              <button
                onClick={toggleSpin}
                className={`p-1 rounded-md transition-all ${
                  spinning ? "text-violet-600 bg-violet-100" : "text-muted-foreground hover:bg-violet-50"
                }`}
                title={spinning ? "Stop rotation" : "Start rotation"}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={resetCamera}
                className="p-1 rounded-md text-muted-foreground hover:bg-violet-50 transition-all"
                title="Reset camera"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="p-1 rounded-md text-muted-foreground hover:bg-violet-50 transition-all"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setPopoutOpen(true)}
                className="p-1 rounded-md text-muted-foreground hover:bg-violet-50 transition-all"
                title="Pop out viewer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3D Viewer container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: actualHeight,
          position: "relative",
          transition: "height 0.3s ease",
        }}
      />

      {/* Loading overlay */}
      {status === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/90"
          style={{ top: 28 }}
        >
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-violet-200" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Fetching 3D conformer from PubChem…</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 px-6"
          style={{ top: 28 }}
        >
          <div className="text-3xl mb-2">🧪</div>
          <p className="text-xs text-muted-foreground text-center">{errorMsg}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {smiles ? `SMILES: ${smiles.slice(0, 40)}…` : "No SMILES available"}
          </p>
        </div>
      )}

      {/* SMILES footer */}
      {smiles && status === "ready" && (
        <div className="px-3 py-1 bg-gray-50 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground font-mono truncate" title={smiles}>
            SMILES: {smiles}
          </p>
        </div>
      )}
      {/* Popout overlay (opened via header button) */}
      {popoutOpen && (
        <Molecule3DPopout name={name} smiles={smiles} cid={cid} onClose={() => setPopoutOpen(false)} />
      )}
    </div>
  );
}

// Render popout overlay at app level when requested
export function Molecule3DViewerWithPopout(props: any) {
  const [popoutOpen, setPopoutOpen] = useState(false);
  return (
    <>
      <Molecule3DViewer {...props} />
      {popoutOpen && (
        <Molecule3DPopout name={props.name} smiles={props.smiles} cid={props.cid} onClose={() => setPopoutOpen(false)} />
      )}
    </>
  );
}
