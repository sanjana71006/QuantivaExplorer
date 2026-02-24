import { useEffect, useRef, useState } from "react";

type Props = {
  smiles?: string | null;
  name?: string | null;
  cid?: number | string | null;
  size?: number;
};

declare global {
  interface Window {
    SmilesDrawer?: any;
  }
}

export default function MoleculeSketch({ smiles, name, cid, size = 80 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pubchemUrl, setPubchemUrl] = useState<string | null>(null);
  const [pubchemFailed, setPubchemFailed] = useState(false);

  // Try to get PubChem image URL
  useEffect(() => {
    setPubchemFailed(false);
    setPubchemUrl(null);

    // Build PubChem URL - prefer CID, then name, then SMILES
    let url: string | null = null;
    
    if (cid) {
      url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=${size}x${size}`;
    } else if (name && name.length > 1) {
      url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/PNG?image_size=${size}x${size}`;
    } else if (smiles && smiles.length > 1) {
      // SMILES needs to be URL encoded
      url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/PNG?image_size=${size}x${size}`;
    }

    if (url) {
      setPubchemUrl(url);
    } else {
      setPubchemFailed(true);
    }
  }, [smiles, name, cid, size]);

  // Fallback to SmilesDrawer if PubChem fails
  useEffect(() => {
    if (!pubchemFailed || !smiles) return;
    
    let mounted = true;
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const render = () => {
      try {
        const SD = window.SmilesDrawer;
        if (!SD) return false;

        const drawer = new SD.Drawer({
          width: size,
          height: size,
        });

        SD.parse(smiles, (tree: any) => {
          if (!mounted || !containerRef.current) return;
          containerRef.current.innerHTML = "";
          drawer.draw(tree, containerRef.current, "light", false);
        });

        return true;
      } catch {
        return false;
      }
    };

    if (render()) return;

    const scriptId = "smiles-drawer-cdn";
    const scriptUrl = "https://unpkg.com/smiles-drawer/dist/smiles-drawer.min.js";

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const onLoad = () => render();

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.addEventListener("load", onLoad);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad);
    }

    return () => {
      mounted = false;
      script?.removeEventListener("load", onLoad);
    };
  }, [pubchemFailed, smiles, size]);

  const handleImageError = () => {
    setPubchemFailed(true);
    setPubchemUrl(null);
  };

  // Show PubChem image if available
  if (pubchemUrl && !pubchemFailed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: 4,
        }}
        aria-label={name ?? smiles ?? "molecule"}
      >
        <img
          src={pubchemUrl}
          alt={name ?? smiles ?? "Molecular structure"}
          width={size}
          height={size}
          onError={handleImageError}
          style={{ objectFit: "contain" }}
        />
      </div>
    );
  }

  // Fallback container for SmilesDrawer
  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "#0f172a",
        background: "white",
        borderRadius: 4,
      }}
      aria-label={smiles ?? "molecule"}
    >
      {!smiles && "No structure"}
    </div>
  );
}