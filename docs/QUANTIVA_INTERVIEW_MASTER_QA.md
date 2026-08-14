# Quantiva Explorer - Interview Master Q&A

## Project Summary
**Quantiva Explorer** is a quantum-inspired drug discovery exploration platform that helps users search, compare, score, and visualize molecular candidates using probabilistic ranking and interactive 3D interfaces.

---

## 1) What datasets are used in this project?
The project uses four core datasets:

1. **processed_dataset.json** (final merged and engineered dataset)
2. **cleaned_dataset.csv** (tabular version of the final merged dataset)
3. **delaney-processed.csv** (solubility-focused source dataset)
4. **PubChem_compound_antibiotic.csv** (large PubChem-derived source dataset)

It also supports **live API retrieval** from PubChem and ChEMBL at runtime.

---

## 2) What are dataset sizes and important attributes?
### Dataset sizes
1. processed_dataset.json: **3,487** rows
2. cleaned_dataset.csv: **3,487** rows
3. delaney-processed.csv: **1,128** rows
4. PubChem_compound_antibiotic.csv: **2,359** rows

### Source distribution in final merged data
1. pubchem_antibiotic: **2,359**
2. delaney_solubility: **1,128**

### Important attributes in final dataset
1. candidate_id
2. source_dataset
3. name
4. smiles
5. molecular_weight
6. polar_area
7. xlogp
8. h_bond_donor_count
9. h_bond_acceptor_count
10. rotatable_bond_count
11. binding_score
12. toxicity
13. stability
14. solubility
15. efficacy_index
16. safety_index
17. molecular_complexity
18. drug_score
19. priority_rank

---

## 3) What are the target variables?
There is no single supervised ML target label trained inside the app runtime. Instead, the platform computes ranking targets through engineered scoring:

1. **drug_score**: primary composite ranking score
2. **priority_rank**: final rank after sorting by drug_score

Intermediate engineered targets used for scoring:
1. efficacy_index
2. safety_index
3. molecular_complexity

---

## 4) Which APIs are used in this project?
### External APIs
1. **PubChem PUG REST API**
2. **ChEMBL API**
3. **Google Gemini API** (assistant responses)

### Internal APIs (backend)
1. /api/meta
2. /api/candidates
3. /api/score
4. /api/molecule/:name
5. /api/disease-search
6. /api/live-molecules
7. /api/chat

---

## 5) What data is retrieved from APIs?
From PubChem/ChEMBL the app retrieves:
1. Compound ID
2. Name
3. Molecular weight
4. LogP
5. H-bond donor count
6. H-bond acceptor count
7. SMILES
8. Optional additional metadata (for example, TPSA, image references)

Then the backend computes normalized and derived values:
1. efficacy_index
2. safety_index
3. molecular_complexity
4. weighted_score
5. probability

---

## 6) How many samples are retrieved from APIs?
It is configurable per endpoint.

1. Molecule-by-name endpoint: up to **50** results
2. Disease search endpoint: up to **50** results
3. Live molecules endpoint: default **50**, configurable up to **1000**

---

## 7) Code snippet: How API integration is implemented
```javascript
// Backend live fetch strategy: PubChem -> ChEMBL -> Local fallback
app.get('/api/live-molecules', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 1000);
  let rows = [];
  let source = null;

  try {
    rows = await fetchFromPubchem({ limit, timeoutMs: 3000 });
    source = 'pubchem';
  } catch {
    try {
      rows = await fetchFromChembl({ limit, timeoutMs: 3000 });
      source = 'chembl';
    } catch {
      rows = await loadLocalDataset({ limit });
      source = 'local';
    }
  }

  return res.json({ source, count: rows.length, items: rows });
});
```

```typescript
// Frontend consumption
const url = `${apiBase}/api/live-molecules?limit=${limit}&alpha=${alpha}&timeoutMs=${timeoutMs}`;
const res = await fetch(url);
```

---

## 8) Where is "quantum" used in this project?
This is **quantum-inspired**, not quantum hardware execution.

Quantum-inspired elements:
1. Softmax-based probabilistic ranking
2. Probability diffusion via a quantum-walk-like process on molecular similarity graph
3. Exploration of non-obvious candidates through probability redistribution
4. Classical vs quantum-style comparative view

---

## 9) How are molecules ranked?
### Core ranking formula
Drug candidate score is a weighted combination of:
1. efficacy
2. safety
3. complexity balance

Default weighted composition:
1. efficacy: 0.45
2. safety: 0.35
3. complexityBalance: 0.20

Molecules are then sorted descending by score and assigned rank.

In frontend exploration mode, additional weighted scoring + softmax probabilities + optional diffusion is applied.

---

## 10) Important points and concepts to remember
1. This is an **end-to-end platform**: data ingestion, harmonization, feature engineering, ranking, visualization, and reporting.
2. Uses **multi-source molecular data** with schema harmonization.
3. Includes **resilient fallback architecture** (PubChem -> ChEMBL -> Local).
4. Supports **interactive 3D molecular exploration** and comparative analysis.
5. Implements **user authentication and persistence** for saved experiments/configurations.
6. "Quantum" claim is **inspired algorithmic design**, not QPU execution.
7. Strong practical focus: explainable ranking factors and reproducible experiments.

---

## 11) Resume point defense (interview-ready)
### Resume Point A
"Built a platform for exploring drug compounds through molecular search, AI-assisted ranking, and interactive visualization."

**How to defend:**
1. Implemented molecular search through live API-backed endpoints and disease keyword retrieval.
2. Built weighted scoring and probability-based ranking engine for candidate prioritization.
3. Added interactive 2D/3D visualization and ranking dashboards for exploration.

### Resume Point B
"Enabled users to compare molecular properties and identify promising drug candidates using an interactive 3D visualization interface."

**How to defend:**
1. Added side-by-side and split views (classical vs quantum-inspired scoring).
2. Enabled property-level comparison (MW, LogP, H-bond features, scores, confidence).
3. Used 3D molecular universe visualization to inspect clusters and high-value candidates interactively.

---

## 12) Project architecture (for interview whiteboard drawing)
Use this simple 6-block architecture in interview:

1. **User Interface Layer (React + TypeScript + Three.js)**
   - Search, filters, ranking dashboard, 3D visualization, assistant UI

2. **Application Logic Layer (Frontend State + Scoring Controller)**
   - Weight tuning, simulation controls, diffusion toggles, result orchestration

3. **API Gateway Layer (Node.js + Express)**
   - Unified REST endpoints for candidates, scoring, molecule search, disease search, chat

4. **Data Integration Layer**
   - PubChem connector
   - ChEMBL connector
   - Local dataset fallback loader

5. **Scoring & Intelligence Layer**
   - Feature engineering
   - Weighted ranking
   - Softmax probability assignment
   - Quantum-inspired probability diffusion

6. **Persistence Layer (MongoDB + JSON fallback)**
   - Users, experiments, configs, history, reports

Suggested interview drawing flow:
**UI -> API -> Integrations/Data -> Scoring Engine -> Persistence -> UI**

---

## 13) Technologies used
1. React.js
2. TypeScript
3. Three.js / React Three Fiber / Drei
4. Node.js
5. Express.js
6. MongoDB + Mongoose
7. JWT authentication
8. bcrypt password hashing
9. PubChem and ChEMBL APIs
10. Gemini API integration (assistant mode)

---

## 14) Challenges faced and how they were solved
1. **Heterogeneous dataset schemas**
   - Solved via schema harmonization + feature engineering pipeline.
2. **External API reliability and latency**
   - Solved with timeout handling, caching, and fallback hierarchy.
3. **Interpretable ranking**
   - Solved with explicit weighted scoring and visible metrics.
4. **Visualization performance for many molecules**
   - Solved using efficient rendering approaches and sampling controls.
5. **User-specific experiment persistence**
   - Solved with auth + user-scoped storage models.

---

## 15) Does this solution already exist? If yes, what is your novelty?
### Existing landscape
Yes, molecular viewers, cheminformatics tools, and docking/ranking systems exist (for example, PubChem browser tools, ChEMBL browsing, and specialized drug-design software).

### Your novelty
1. **Unified educational + exploratory workflow** in one platform (search + rank + compare + 3D visualize + save experiments).
2. **Quantum-inspired probabilistic exploration layer** integrated with practical web UX.
3. **Hybrid reliability strategy** (live API first, local fallback always available).
4. **Interview/demo-friendly explainability** (clear score components and ranking logic).
5. **Fast prototyping architecture** suitable for hackathon and extensible for research tooling.

---

## 16) 60-second closing pitch (memorize)
"Quantiva Explorer is a quantum-inspired molecular exploration platform that integrates public chemical data, engineered drug-likeness scoring, and interactive 3D visualization to help researchers quickly identify promising candidates. It combines weighted ranking, probabilistic diffusion, and multi-source data fallback for robust, explainable, and scalable exploration. Beyond visualization, it supports reproducible experiments with user-scoped persistence, making it both practical for demos and extensible for serious drug discovery workflows."

---

## 17) Additional Interview FAQs (ML and AI clarity)
### Q1) What ML models are used?
**Answer:**
The current implementation is primarily a **rule-based and probabilistic ranking system**, not a deep supervised ML pipeline with a trained classifier/regressor checkpoint.

What is used:
1. Engineered feature scoring (efficacy, safety, complexity)
2. Weighted composite ranking
3. Softmax probability normalization
4. Quantum-inspired probability diffusion over similarity graph

AI/LLM used:
1. Gemini integration is used for assistant-style explanations and conversational help.

Interview-safe line:
"We use AI-assisted ranking and explanation layers with probabilistic scoring and diffusion, but this version does not train a custom end-to-end deep model in production."

### Q2) Why is it called AI-assisted?
**Answer:**
It is called AI-assisted because the platform uses:
1. AI-style scoring heuristics for candidate prioritization
2. Probabilistic ranking and diffusion to surface non-obvious candidates
3. LLM-powered assistant for contextual molecule/project guidance

So the system **assists decision-making** for researchers rather than claiming autonomous clinical decision output.

### Q3) Do we have classification based on disease?
**Answer:**
Not as a trained disease classifier model. Instead, the platform has **disease-aware profile logic**:
1. Disease keyword/category inference
2. Category-specific weight adjustments
3. Disease-targeted retrieval via disease keyword search

This is profile-driven prioritization, not a medical diagnosis classifier.

### Q4) How many diseases/categories are listed?
**Answer:**
The app currently supports **6 therapeutic categories**:
1. Cancer
2. Infectious
3. CNS / Neurological
4. Metabolic
5. Cardiovascular
6. General

### Q5) Does it provide a single drug or a combination of drugs?
**Answer:**
It currently returns a **ranked list of individual candidate molecules**.
It does **not** generate optimized multi-drug combination therapy plans in the current implementation.

### Q6) Is Lipinski used here? What is it?
**Answer:**
Yes, Lipinski is used in both dataset engineering and frontend scoring checks.

**Lipinski Rule of Five** is a classic drug-likeness heuristic that checks if a compound is likely to have good oral bioavailability:
1. Molecular weight <= 500
2. LogP <= 5
3. H-bond donors <= 5
4. H-bond acceptors <= 10

How it is used in this project:
1. Lipinski compliance contributes to safety/drug-likeness evaluation.
2. It affects filtering and ranking confidence.
3. It is exposed in UI explanations for interpretability.

---

## 18) Sharp one-liners for interviewer cross-questions
1. **Model question:** "This version focuses on engineered probabilistic intelligence rather than training a monolithic black-box model."
2. **AI claim question:** "AI-assisted here means ranked decision support plus LLM explanations, not autonomous prescription."
3. **Disease question:** "We support disease-aware prioritization profiles, not diagnostic disease classification."
4. **Output question:** "Current output is prioritized single compounds; combination therapy is future scope."
5. **Lipinski question:** "Lipinski is one of our core drug-likeness constraints for safe, explainable prioritization."
