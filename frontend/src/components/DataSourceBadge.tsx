import React from "react";

export default function DataSourceBadge({ source }: { source: string | null }) {
  const label = source === 'pubchem' ? 'Live PubChem' : source === 'local' ? 'Local Dataset' : source === 'cache' ? 'Cached' : 'Unknown';
  const color = source === 'pubchem' ? 'bg-green-500' : source === 'local' ? 'bg-gray-500' : source === 'cache' ? 'bg-yellow-500' : 'bg-slate-400';
  return (
    <div className={`px-2 py-1 rounded text-xs text-white ${color} shadow-sm`}>Data Source: {label}</div>
  );
}
