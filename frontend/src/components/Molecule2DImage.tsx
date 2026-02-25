import React from 'react';
import { getMoleculeImageUrl } from '@/services/pubchemApi';

interface Props {
  cid?: number | string;
  name?: string;
  smiles?: string;
  size?: number;
  className?: string;
}

export default function Molecule2DImage({ cid, name, smiles, size = 240, className = '' }: Props) {
  // Prefer a locally cached image if available
  const localPath = cid ? `/molecule_images/${cid}.png` : null;

  // Construct PubChem fallback URLs
  const pubchemBySmiles = smiles
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/PNG?image_size=${size}x${size}`
    : null;
  const pubchemByName = name
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/PNG?image_size=${size}x${size}`
    : null;

  const fallbackUrl = cid
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(String(cid))}/PNG?image_size=${size}x${size}`
    : (pubchemBySmiles || pubchemByName);

  const src = localPath; // try local first; <img> onError will fall back to PubChem

  return (
    <div className={`rounded bg-white overflow-hidden flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img
        src={src || fallbackUrl || (cid ? getMoleculeImageUrl(Number(cid)) : '')}
        alt={name || smiles || `molecule-${cid}`}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          if (t.src && t.src.includes('/molecule_images/') && (pubchemBySmiles || pubchemByName)) {
            // try PubChem
            t.src = pubchemBySmiles || pubchemByName || fallbackUrl || '';
            return;
          }
          // final fallback to SMILES-rendering endpoint
          if (pubchemBySmiles) {
            t.src = pubchemBySmiles;
            return;
          }
          // show empty placeholder
          t.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999">No image</text></svg>';
        }}
      />
    </div>
  );
}
