import { useEffect, useRef } from "react";

type Props = {
  smiles?: string | null;
  size?: number;
};

declare global {
  interface Window {
    SmilesDrawer?: any;
  }
}

export default function MoleculeSketch({ smiles, size = 80 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    if (!smiles) {
      container.textContent = "No SMILES";
      return;
    }

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

    // If already loaded
    if (render()) return;

    const scriptId = "smiles-drawer-cdn";
    const scriptUrl =
      "https://unpkg.com/smiles-drawer/dist/smiles-drawer.min.js";

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
  }, [smiles, size]);

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
      }}
      aria-label={smiles ?? "molecule"}
    />
  );
}