from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

# optional RDKit fallback for computing LogP from SMILES
try:
    # rdkit is optional; silence Pylance/reportMissingImports when not installed
    from rdkit import Chem  # type: ignore[reportMissingImports]
    from rdkit.Chem.Crippen import MolLogP  # type: ignore[reportMissingImports]
    _HAS_RDKIT = True
except Exception:
    _HAS_RDKIT = False


WORKSPACE = Path(__file__).resolve().parents[1]

INPUT_FILES = {
    "delaney": WORKSPACE / "delaney-processed.csv",
    "pubchem": WORKSPACE / "PubChem_compound_antibiotic.csv",
    "quantum": WORKSPACE / "quantum_drug_candidates.csv",
}

OUTPUT_CSV = WORKSPACE / "cleaned_dataset.csv"
OUTPUT_JSON = WORKSPACE / "processed_dataset.json"
OUTPUT_FEATURES = WORKSPACE / "feature_description.txt"
OUTPUT_REPORT = WORKSPACE / "data_quality_report.txt"


def to_snake_case(name: str) -> str:
    name = name.strip()
    name = re.sub(r"[^\w\s]", " ", name)
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    name = re.sub(r"[\s\-]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_").lower()


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [to_snake_case(c) for c in df.columns]
    return df


def profile_dataframe(df: pd.DataFrame, name: str) -> Dict[str, object]:
    num_df = df.select_dtypes(include=[np.number])
    outlier_counts: Dict[str, int] = {}
    for col in num_df.columns:
        series = num_df[col].dropna()
        if series.empty:
            outlier_counts[col] = 0
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            outlier_counts[col] = 0
            continue
        lo = q1 - 1.5 * iqr
        hi = q3 + 1.5 * iqr
        outlier_counts[col] = int(((series < lo) | (series > hi)).sum())

    return {
        "dataset": name,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": list(df.columns),
        "dtypes": {k: str(v) for k, v in df.dtypes.items()},
        "missing_by_column": {k: int(v) for k, v in df.isna().sum().items()},
        "total_missing": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "outliers_iqr": outlier_counts,
    }


def clip_numeric_outliers(df: pd.DataFrame, ignore_cols: List[str] | None = None) -> pd.DataFrame:
    df = df.copy()
    ignore_cols = set(ignore_cols or [])
    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c not in ignore_cols]
    for col in num_cols:
        s = df[col]
        if s.dropna().empty:
            continue
        q1 = s.quantile(0.01)
        q99 = s.quantile(0.99)
        if pd.isna(q1) or pd.isna(q99):
            continue
        if q1 == q99:
            continue
        df[col] = s.clip(lower=q1, upper=q99)
    return df


def minmax(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce")
    mn = s.min(skipna=True)
    mx = s.max(skipna=True)
    if pd.isna(mn) or pd.isna(mx) or mn == mx:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - mn) / (mx - mn)


def compute_lipinski_ratio(df: pd.DataFrame) -> pd.Series:
    checks = []

    if "molecular_weight" in df.columns:
        checks.append((pd.to_numeric(df["molecular_weight"], errors="coerce") <= 500).astype(float))
    if "xlogp" in df.columns:
        xlogp = pd.to_numeric(df["xlogp"], errors="coerce")
        checks.append(((xlogp >= -0.5) & (xlogp <= 5.0)).astype(float))
    if "h_bond_donor_count" in df.columns:
        checks.append((pd.to_numeric(df["h_bond_donor_count"], errors="coerce") <= 5).astype(float))
    if "h_bond_acceptor_count" in df.columns:
        checks.append((pd.to_numeric(df["h_bond_acceptor_count"], errors="coerce") <= 10).astype(float))
    if "rotatable_bond_count" in df.columns:
        checks.append((pd.to_numeric(df["rotatable_bond_count"], errors="coerce") <= 10).astype(float))
    if "polar_area" in df.columns:
        checks.append((pd.to_numeric(df["polar_area"], errors="coerce") <= 140).astype(float))

    if not checks:
        return pd.Series(np.full(len(df), 0.5), index=df.index)

    m = pd.concat(checks, axis=1)
    return m.mean(axis=1).fillna(0.5)


def prepare_pubchem(df: pd.DataFrame) -> pd.DataFrame:
    df = normalize_columns(df)
    df = df.drop_duplicates().copy()

    string_cols = df.select_dtypes(include=["object"]).columns
    for col in string_cols:
        df[col] = df[col].astype(str).str.strip().replace({"nan": np.nan, "": np.nan})

    if "create_date" in df.columns:
        # Convert YYYYMMDD integer/date-like strings to ISO date for web compatibility.
        date_str = df["create_date"].astype(str).str.replace(r"\.0$", "", regex=True)
        dt = pd.to_datetime(date_str, format="%Y%m%d", errors="coerce")
        df["create_date"] = dt.dt.strftime("%Y-%m-%d")

    df = clip_numeric_outliers(df, ignore_cols=["compound_cid"])

    keep_cols = [
        "compound_cid",
        "name",
        "smiles",
        "molecular_formula",
        "molecular_weight",
        "polar_area",
        "complexity",
        "xlogp",
        "heavy_atom_count",
        "h_bond_donor_count",
        "h_bond_acceptor_count",
        "rotatable_bond_count",
        "charge",
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()

    out["source_dataset"] = "pubchem_antibiotic"
    out["candidate_id"] = "pubchem_" + out["compound_cid"].astype(str)

    if "name" in out.columns:
        out["name"] = out["name"].fillna("unknown")
    if "smiles" in out.columns:
        out["smiles"] = out["smiles"].fillna("unknown")

    return out


def prepare_delaney(df: pd.DataFrame) -> pd.DataFrame:
    df = normalize_columns(df)
    df = df.drop_duplicates().copy()

    col_map = {
        "compound_id": "name",
        "number_of_h_bond_donors": "h_bond_donor_count",
        "number_of_rotatable_bonds": "rotatable_bond_count",
        "polar_surface_area": "polar_area",
        "measured_log_solubility_in_mols_per_litre": "measured_log_solubility",
        "esol_predicted_log_solubility_in_mols_per_litre": "predicted_log_solubility",
        "minimum_degree": "minimum_degree",
    }
    for src, tgt in col_map.items():
        if src in df.columns and src != tgt:
            df = df.rename(columns={src: tgt})

    df = clip_numeric_outliers(df)

    keep_cols = [
        "name",
        "smiles",
        "molecular_weight",
        "h_bond_donor_count",
        "rotatable_bond_count",
        "polar_area",
        "measured_log_solubility",
        "predicted_log_solubility",
        "minimum_degree",
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()

    out["source_dataset"] = "delaney_solubility"
    out["candidate_id"] = "delaney_" + out.index.astype(str)
    out["name"] = out.get("name", pd.Series(["unknown"] * len(out))).fillna("unknown").astype(str)
    out["smiles"] = out.get("smiles", pd.Series(["unknown"] * len(out))).fillna("unknown").astype(str)
    return out


def prepare_quantum(df: pd.DataFrame) -> pd.DataFrame:
    df = normalize_columns(df)
    df = df.drop_duplicates().copy()

    for col in ["binding_score", "toxicity", "stability", "solubility"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").clip(0, 1)

    out = df.copy()
    out["source_dataset"] = "quantum_candidates"
    out["candidate_id"] = out.get("molecule_id", pd.Series(range(len(out)))).astype(str)
    out["name"] = out.get("molecule_id", pd.Series(["unknown"] * len(out))).astype(str)
    out["smiles"] = "unknown"
    return out


def harmonize_and_engineer(dfs: List[pd.DataFrame]) -> pd.DataFrame:
    combined = pd.concat(dfs, ignore_index=True, sort=False)

    # Standardize all column names one final time.
    combined = normalize_columns(combined)

    # Ensure numeric fields are numeric.
    numeric_candidates = [
        "molecular_weight",
        "polar_area",
        "complexity",
        "xlogp",
        "heavy_atom_count",
        "h_bond_donor_count",
        "h_bond_acceptor_count",
        "rotatable_bond_count",
        "charge",
        "binding_score",
        "toxicity",
        "stability",
        "solubility",
        "measured_log_solubility",
        "predicted_log_solubility",
        "minimum_degree",
    ]
    # Compute xlogp (logP) from SMILES when values are missing or zero.
    # Prefer RDKit if available, otherwise leave NaN to be imputed by median.
    if "smiles" in combined.columns:
        if "xlogp" not in combined.columns:
            combined["xlogp"] = np.nan

        def compute_logp_from_smiles(smiles: str) -> float:
            if not _HAS_RDKIT:
                return np.nan
            try:
                if pd.isna(smiles) or not isinstance(smiles, str) or smiles.strip().lower() in {"", "unknown", "nan"}:
                    return np.nan
                m = Chem.MolFromSmiles(smiles)
                if m is None:
                    return np.nan
                return float(MolLogP(m))
            except Exception:
                return np.nan

        missing_logp = combined["xlogp"].isna() | (pd.to_numeric(combined["xlogp"], errors="coerce") == 0)
        # Only attempt compute when SMILES present and RDKit is available.
        if missing_logp.any():
            if _HAS_RDKIT:
                combined.loc[missing_logp, "xlogp"] = (
                    combined.loc[missing_logp, "smiles"].apply(compute_logp_from_smiles)
                )
            else:
                # RDKit not available: apply a lightweight heuristic to estimate logP
                def heuristic_logp(row: pd.Series) -> float:
                    try:
                        mw = float(row.get("molecular_weight") or 0.0)
                        pa = float(row.get("polar_area") or 0.0)
                    except Exception:
                        return np.nan
                    # baseline near 2.0, increase with MW, decrease with polar area
                    est = 2.0 + (mw - 350.0) / 250.0 - (pa - 50.0) / 200.0
                    return float(np.clip(est, -2.0, 6.0))

                try:
                    combined.loc[missing_logp, "xlogp"] = (
                        combined.loc[missing_logp].apply(heuristic_logp, axis=1)
                    )
                except Exception:
                    combined.loc[missing_logp, "xlogp"] = np.nan
    for col in numeric_candidates:
        if col in combined.columns:
            combined[col] = pd.to_numeric(combined[col], errors="coerce")

    # Critical text fields.
    for col in ["candidate_id", "source_dataset", "name", "smiles"]:
        if col not in combined.columns:
            combined[col] = "unknown"
        combined[col] = combined[col].astype(str).fillna("unknown")

    # Impute critical numeric columns with robust medians.
    critical_numeric = [
        "molecular_weight",
        "polar_area",
        "h_bond_donor_count",
        "h_bond_acceptor_count",
        "rotatable_bond_count",
        "binding_score",
        "toxicity",
        "stability",
        "solubility",
        "complexity",
    ]
    for col in critical_numeric:
        if col not in combined.columns:
            combined[col] = np.nan
        median_val = pd.to_numeric(combined[col], errors="coerce").median(skipna=True)
        if pd.isna(median_val):
            median_val = 0.0
        combined[col] = pd.to_numeric(combined[col], errors="coerce").fillna(median_val)

    # Additional inferred solubility from Delaney when direct solubility absent before imputation.
    if "measured_log_solubility" in combined.columns:
        measured_scaled = minmax(combined["measured_log_solubility"])
        combined["solubility"] = np.where(
            combined["source_dataset"] == "delaney_solubility",
            measured_scaled,
            combined["solubility"],
        )

    lipinski_ratio = compute_lipinski_ratio(combined)

    # Normalized helper features
    binding_norm = minmax(combined["binding_score"])
    stability_norm = minmax(combined["stability"])
    solubility_norm = minmax(combined["solubility"])
    toxicity_norm = minmax(combined["toxicity"])
    complexity_norm = minmax(combined["complexity"])
    heavy_atom_norm = minmax(combined["heavy_atom_count"] if "heavy_atom_count" in combined.columns else pd.Series(0, index=combined.index))
    rotatable_norm = minmax(combined["rotatable_bond_count"])

    # Engineered features
    combined["efficacy_index"] = (0.6 * binding_norm + 0.2 * stability_norm + 0.2 * solubility_norm).clip(0, 1)
    combined["safety_index"] = (0.7 * (1 - toxicity_norm) + 0.3 * lipinski_ratio).clip(0, 1)
    combined["molecular_complexity"] = (0.5 * complexity_norm + 0.3 * heavy_atom_norm + 0.2 * rotatable_norm).clip(0, 1)

    complexity_balance = (1 - (combined["molecular_complexity"] - 0.5).abs() * 2).clip(0, 1)
    combined["drug_score"] = (
        0.45 * combined["efficacy_index"]
        + 0.35 * combined["safety_index"]
        + 0.20 * complexity_balance
    ).clip(0, 1)

    combined = combined.sort_values("drug_score", ascending=False).reset_index(drop=True)
    combined["priority_rank"] = np.arange(1, len(combined) + 1)

    # Frontend-friendly compact schema.
    final_cols = [
        "candidate_id",
        "source_dataset",
        "name",
        "smiles",
        "molecular_weight",
        "polar_area",
        "xlogp",
        "h_bond_donor_count",
        "h_bond_acceptor_count",
        "rotatable_bond_count",
        "binding_score",
        "toxicity",
        "stability",
        "solubility",
        "efficacy_index",
        "safety_index",
        "molecular_complexity",
        "drug_score",
        "priority_rank",
    ]
    for col in final_cols:
        if col not in combined.columns:
            combined[col] = np.nan if col not in {"candidate_id", "source_dataset", "name", "smiles"} else "unknown"

    final_df = combined[final_cols].copy()

    # Enforce types for web compatibility.
    float_cols = [c for c in final_cols if c not in {"candidate_id", "source_dataset", "name", "smiles", "priority_rank"}]
    for col in float_cols:
        final_df[col] = pd.to_numeric(final_df[col], errors="coerce").fillna(0.0).round(6)
    final_df["priority_rank"] = pd.to_numeric(final_df["priority_rank"], errors="coerce").fillna(0).astype(int)

    return final_df


def generate_feature_description(path: Path) -> None:
    text = """Feature descriptions for AI-driven drug candidate ranking

1) drug_score
   Composite ranking score in [0,1], weighted by efficacy_index (45%), safety_index (35%),
   and complexity balance (20%). Higher is better.

2) safety_index
   Safety proxy in [0,1], combining inverse toxicity (if available) and Lipinski-style rule compliance.
   Higher indicates lower estimated risk and better oral-drug-likeness.

3) efficacy_index
   Efficacy proxy in [0,1], combining binding_score, stability, and solubility (normalized).
   Higher indicates better predicted therapeutic performance.

4) molecular_complexity
   Normalized structural complexity proxy in [0,1], derived from complexity, heavy atom count,
   and rotatable bond count. Used to avoid over- or under-complex candidates.

5) priority_rank
   Integer rank after sorting by drug_score descending. Rank 1 is highest priority.

Assumptions
- Datasets have heterogeneous schema and partially missing fields; robust median imputation is applied.
- Outliers are winsorized (1st-99th percentile) to stabilize real-time scoring.
- Delaney measured log solubility is min-max normalized to align with [0,1] solubility scale.
- Frontend compatibility is prioritized: snake_case columns, numeric consistency, CSV+JSON exports.
"""
    path.write_text(text, encoding="utf-8")


def generate_quality_report(
    initial_profiles: List[Dict[str, object]],
    final_df: pd.DataFrame,
    report_path: Path,
) -> None:
    critical_cols = [
        "candidate_id",
        "source_dataset",
        "drug_score",
        "safety_index",
        "efficacy_index",
        "priority_rank",
    ]
    critical_nulls = {c: int(final_df[c].isna().sum()) for c in critical_cols}
    numeric_cols = final_df.select_dtypes(include=[np.number]).columns

    lines: List[str] = []
    lines.append("Data Quality Report - Quantum-Inspired Drug Candidate Exploration")
    lines.append("=" * 70)
    lines.append("")
    lines.append("Step 1: Dataset diagnostics")
    for p in initial_profiles:
        lines.append(f"- {p['dataset']}: rows={p['rows']}, cols={p['columns']}, total_missing={p['total_missing']}, duplicates={p['duplicate_rows']}")

    lines.append("")
    lines.append("Step 2: Cleaning summary")
    lines.append("- Standardized all columns to snake_case.")
    lines.append("- Removed exact duplicates per source dataset.")
    lines.append("- Applied robust numeric imputation (median) on critical numeric fields.")
    lines.append("- Winsorized numeric outliers at 1st/99th percentile to reduce scoring instability.")
    lines.append("- Harmonized heterogeneous schemas into one candidate table.")

    lines.append("")
    lines.append("Step 3: Engineered features")
    lines.append("- efficacy_index, safety_index, molecular_complexity, drug_score, priority_rank")

    lines.append("")
    lines.append("Step 4: Final dataset status")
    lines.append(f"- Final rows: {len(final_df)}")
    lines.append(f"- Final columns: {len(final_df.columns)}")
    lines.append(f"- Critical null counts: {critical_nulls}")
    lines.append(f"- Numeric columns: {list(numeric_cols)}")
    lines.append(f"- Duplicate rows in final dataset: {int(final_df.duplicated().sum())}")

    suitability = (
        "Suitable for real-time scoring/filtering and web visualization: compact schema, "
        "normalized engineered metrics, no critical nulls, and deterministic ranking."
    )
    lines.append("")
    lines.append("Suitability assessment")
    lines.append(f"- {suitability}")

    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    raw: Dict[str, pd.DataFrame] = {}
    initial_profiles: List[Dict[str, object]] = []
    for name, path in INPUT_FILES.items():
        try:
            df = pd.read_csv(path)
            raw[name] = df
        except Exception:
            # missing or unreadable input — create empty dataframe and note in profile
            raw[name] = pd.DataFrame()
        initial_profiles.append(profile_dataframe(raw[name], name))

    pubchem = prepare_pubchem(raw["pubchem"])
    delaney = prepare_delaney(raw["delaney"])
    quantum = prepare_quantum(raw["quantum"])

    final_df = harmonize_and_engineer([pubchem, delaney, quantum])

    final_df.to_csv(OUTPUT_CSV, index=False)
    OUTPUT_JSON.write_text(final_df.to_json(orient="records", force_ascii=False), encoding="utf-8")
    generate_feature_description(OUTPUT_FEATURES)
    generate_quality_report(initial_profiles, final_df, OUTPUT_REPORT)

    # Console summary for quick validation
    critical_cols = ["candidate_id", "source_dataset", "drug_score", "safety_index", "efficacy_index", "priority_rank"]
    print("Pipeline completed")
    print(f"Final shape: {final_df.shape}")
    print("Critical nulls:", {c: int(final_df[c].isna().sum()) for c in critical_cols})
    print("Top 5 candidates:")
    print(final_df[["candidate_id", "source_dataset", "drug_score", "priority_rank"]].head(5).to_string(index=False))


if __name__ == "__main__":
    main()
