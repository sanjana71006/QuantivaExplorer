import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const quickPrompts = [
  "Give me top 3 ranked molecules with reasons",
  "Show dataset stats by source",
  "How should I tune efficacy vs safety weights?",
  "Explain Lipinski rules in simple terms",
  "How do I use filters effectively?",
];

const greeting =
  "Hi! I am Quantiva Assistant. Ask me anything about your molecule scoring, filters, and results.";

// Offline response patterns - works without any API connection
function getOfflineResponse(message: string): string | null {
  const lower = message.toLowerCase();

  // Lipinski rules
  if (/lipinski|rule.*five|drug.*like|bioavailability/i.test(lower)) {
    return `Lipinski Rule of Five

A molecule is likely to have good oral bioavailability if it meets these criteria:

1. Molecular Weight <= 500 Da
2. LogP (lipophilicity) <= 5
3. Hydrogen Bond Donors <= 5 (OH and NH groups)
4. Hydrogen Bond Acceptors <= 10 (N and O atoms)

Violations: Compounds with >1 violation may have poor absorption or permeability.

In our scoring system, Lipinski compliance is factored into the drug-likeness assessment and influences the overall candidate ranking.`;
  }

  // Efficacy vs Safety
  if (/efficacy|safety|trade.*off|balance|weight|tuning/i.test(lower)) {
    return `Efficacy vs Safety Trade-offs

Our scoring system uses weighted priorities:

Default Balance:
- Efficacy: 40%
- Safety: 40%
- Complexity: 20%

Efficacy Priority: Use when therapeutic effect is critical
- Efficacy: 65%, Safety: 25%, Complexity: 10%

Safety Priority: Use for vulnerable populations or chronic treatments
- Efficacy: 25%, Safety: 65%, Complexity: 10%

Recommendation: Start with balanced weights, then adjust based on your target indication and patient population.`;
  }

  // Filters help
  if (/filter|search|find|narrow|criteria|effectively/i.test(lower)) {
    return `Using Filters Effectively

Available filters in the dashboard:

- Score Range: Set min/max drug scores (0-1)
- Efficacy Threshold: Minimum efficacy index
- Safety Threshold: Minimum safety index
- Source Dataset: Filter by data source (PubChem, ChEMBL, etc.)
- Search: Text search by name, ID, or SMILES

Tips:
1. Start broad, then narrow progressively
2. Use source filters to compare datasets
3. Combine efficacy + safety thresholds for drug-like candidates
4. Export filtered results for detailed analysis`;
  }

  // Top molecules
  if (/top\s*\d*|best|ranked|highest|leading|molecules.*reason/i.test(lower)) {
    return `Top Ranked Molecules

The system ranks molecules using a weighted scoring algorithm:

Scoring Weights (Default):
- Efficacy: 40%
- Safety: 40%
- Complexity: 20%

Top candidates are selected based on:
1. High efficacy potential (target binding, activity predictions)
2. Excellent safety profile (low toxicity, Lipinski compliance)
3. Balanced molecular complexity (synthetic accessibility)

To see actual top molecules with details, use the Dashboard ranking table.

Tip: Ask for top efficacy or top safety to prioritize specific criteria.`;
  }

  // Dataset stats
  if (/dataset|stats|statistics|overview|summary|source|how many|total/i.test(lower)) {
    return `Dataset Overview

The Quantiva platform aggregates molecules from multiple sources:

Data Sources:
- PubChem: NIH database with 115M+ compounds
- ChEMBL: EBI drug discovery database with 2.4M+ bioactives
- Local Dataset: Pre-processed candidates for offline use

Available Metrics:
- Molecular Weight, LogP, TPSA
- H-Bond Donors and Acceptors
- Efficacy Index (0-1)
- Safety Index (0-1)
- Drug Score (weighted composite)

Use the Dashboard to see real-time statistics and source breakdowns.`;
  }

  // ADMET
  if (/admet|adme|absorption|distribution|metabolism|excretion|toxicity|pharmacokinetic/i.test(lower)) {
    return `ADMET Properties

ADMET stands for Absorption, Distribution, Metabolism, Excretion, and Toxicity:

Absorption - How well the drug enters the bloodstream
Distribution - How the drug spreads through tissues
Metabolism - How the body processes the drug (liver enzymes)
Excretion - How the drug is eliminated (kidneys, bile)
Toxicity - Potential harmful effects

In Quantiva, our safety index incorporates toxicity predictions, and drug-likeness scores reflect ADME properties.`;
  }

  // LogP
  if (/logp|log\s*p|partition.*coefficient|lipophilicity/i.test(lower)) {
    return `LogP (Partition Coefficient)

LogP measures lipophilicity - preference for fat vs water:

- LogP < 0: Hydrophilic (water-loving)
- LogP 0-3: Balanced (ideal for oral drugs)
- LogP 3-5: Moderately lipophilic
- LogP > 5: Highly lipophilic (Lipinski violation)

Optimal Range: LogP 1-3 for most oral drugs

LogP affects absorption, BBB penetration, and solubility.`;
  }

  // TPSA
  if (/tpsa|polar.*surface/i.test(lower)) {
    return `TPSA (Topological Polar Surface Area)

TPSA measures the surface area of polar atoms (N, O, and attached H):

- TPSA < 60 sq A: Good BBB penetration (CNS drugs)
- TPSA < 140 sq A: Good intestinal absorption
- TPSA > 140 sq A: Poor oral bioavailability likely

Lower TPSA = better membrane permeability.`;
  }

  // BBB
  if (/bbb|blood.*brain|brain.*barrier|cns/i.test(lower)) {
    return `Blood-Brain Barrier (BBB) Penetration

Key factors for CNS drug design:

Favorable Properties:
- Molecular Weight < 450 Da
- LogP: 1-4 (optimal 2-3)
- TPSA < 60-90 sq A
- H-bond donors <= 3
- H-bond acceptors <= 7

Use CNS/Neurological disease profile for BBB-focused scoring.`;
  }

  // Scoring methodology
  if (/scoring|score.*method|how.*score|calculate|algorithm/i.test(lower)) {
    return `Scoring Methodology

Quantiva uses a weighted multi-factor scoring system:

Core Metrics:
1. Efficacy Index (0-1): Binding potential, target activity
2. Safety Index (0-1): Toxicity predictions, Lipinski compliance
3. Molecular Complexity (0-1): Structural features, synthetic accessibility

Formula:
Score = (w1 x Efficacy) + (w2 x Safety) + (w3 x Complexity)

Default Weights: Efficacy: 40%, Safety: 40%, Complexity: 20%`;
  }

  // Disease profiles
  if (/disease|cancer|diabetes|infection|therapeutic|indication/i.test(lower)) {
    return `Disease-Aware Scoring

Quantiva adapts scoring based on therapeutic targets:

- Cancer: Prioritizes efficacy, binding affinity
- Infectious Disease: Emphasizes safety, broad-spectrum activity
- CNS/Neurological: Optimizes for BBB penetration
- Metabolic: Focuses on oral bioavailability, chronic safety
- Cardiovascular: Balanced profile with cardiac safety emphasis

Enable Disease-Aware Mode in dashboard settings.`;
  }

  // Help/capabilities
  if (/help|what can you|capabilities|features/i.test(lower)) {
    return `Quantiva Assistant Capabilities

I can help with:

Molecules: Lookup compounds, disease searches
Data: Dataset stats, rankings, source info
Concepts: Lipinski rules, ADMET, LogP, TPSA, BBB
Platform: Scoring methodology, filters, exports

Try: Explain Lipinski rules or How does scoring work?`;
  }

  // Greeting
  if (/^(hi|hello|hey|greetings)/i.test(lower)) {
    return `Hi! I am Quantiva Assistant. I can help you with:

- Molecule lookups and disease searches
- Dataset statistics and rankings
- Drug discovery concepts (ADMET, Lipinski, LogP)
- Platform features and scoring methodology

What would you like to explore?`;
  }

  // About/Quantiva
  if (/quantiva|project|what is this|about/i.test(lower)) {
    return `Welcome to Quantiva

Quantiva is a quantum-inspired drug discovery platform that helps researchers:

1. Explore Molecules: Browse candidates from PubChem, ChEMBL
2. Score and Rank: Evaluate using efficacy, safety, complexity
3. Visualize: 3D molecular visualizations
4. Filter and Export: Advanced filtering with reports
5. Disease-Aware Mode: Adaptive scoring for therapeutic areas`;
  }

  // Workflow
  if (/workflow|step|process|how.*start|getting.*started/i.test(lower)) {
    return `Quantiva Workflow

1. Load Dataset: Choose from PubChem, ChEMBL, or local data
2. Configure Scoring: Set efficacy/safety/complexity weights
3. Apply Filters: Narrow by score ranges, source, search
4. Run Exploration: Execute quantum-inspired search
5. Analyze Results: Review ranked molecules, Lipinski compliance
6. Export: Generate scientific reports, download data`;
  }

  // Export
  if (/export|report|download|pdf|csv/i.test(lower)) {
    return `Export and Reports

Available exports:
- Scientific Report (PDF): Summary, top candidates, methodology
- Data Export (CSV/JSON): Full candidate list with scores

How to export:
1. Apply desired filters
2. Click Export in dashboard
3. Choose format and download`;
  }

  // Molecular weight
  if (/molecular.*weight|mw|dalton|mass/i.test(lower)) {
    return `Molecular Weight (MW)

Molecular weight significantly impacts drug properties:

Lipinski Guideline: MW <= 500 Da

Why MW Matters:
- Absorption: Smaller molecules absorb better (< 500 Da)
- BBB Penetration: < 450 Da preferred for CNS drugs
- Solubility: Generally decreases with increasing MW

Size Categories:
- Small molecules: < 500 Da (traditional drugs)
- Beyond Rule of 5: 500-1000 Da`;
  }

  // Hydrogen bonds
  if (/hydrogen.*bond|h.*bond|hbd|hba|donor|acceptor/i.test(lower)) {
    return `Hydrogen Bond Donors and Acceptors

H-Bond Donors (HBD):
- Groups that donate H: -OH, -NH, -NH2
- Lipinski limit: <= 5 donors

H-Bond Acceptors (HBA):
- Groups that accept H: =O, -O-, -N<, -N=
- Lipinski limit: <= 10 acceptors

Impact: More H-bonds = better solubility but worse permeability`;
  }

  // SMILES
  if (/smiles|notation|chemical.*structure/i.test(lower)) {
    return `SMILES Notation

SMILES is a text representation of chemical structures:

Examples:
- Water: O
- Ethanol: CCO
- Aspirin: CC(=O)Oc1ccccc1C(=O)O
- Caffeine: Cn1cnc2c1c(=O)n(c(=O)n2C)C

SMILES allows quick database searches and computational analysis.`;
  }

  // Simulation
  if (/simulation|explore|quantum|run/i.test(lower)) {
    return `Quantum-Inspired Exploration

The simulation explores molecular candidate space probabilistically:

How to Run:
1. Go to Simulation Controls page
2. Set your scoring weights
3. Choose iteration count and batch size
4. Click Start Exploration

Results appear in real-time with probability distributions!`;
  }

  // Dashboard
  if (/dashboard|navigate|interface|ui|page/i.test(lower)) {
    return `Dashboard Navigation

Main Pages:
- Landing Page: Project overview
- Dashboard: Main exploration interface
- Simulation Controls: Run quantum exploration
- Visualization: 3D molecular space view
- Results: Ranked candidates
- Settings: Configure preferences`;
  }

  return null;
}

async function fetchChatReply(message: string, history: ChatMessage[]) {
  const offlineReply = getOfflineResponse(message);
  if (offlineReply) {
    return offlineReply;
  }

  const envBase = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  // Increase timeout for molecule lookups (PubChem API can be slow)
  const REQUEST_TIMEOUT_MS = 30000;

  const sameOrigin = `${window.location.origin.replace(/\/$/, "")}/api`;
  const urls = [] as string[];
  // Prioritize localhost first, then try other endpoints
  urls.push("http://localhost:8080/api");
  urls.push("/api");
  urls.push(sameOrigin);
  if (envBase) urls.push(`${envBase}/api`);

  let lastError = "";
  console.log(`[Chat] Asking: "${message}" - trying ${urls.length} endpoints`);

  for (const baseUrl of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const url = `${baseUrl.replace(/\/$/, "")}/chat`;
      console.log(`[Chat] Trying endpoint: ${url}`);
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        lastError = body?.error || `${res.status} ${res.statusText}`;
        console.warn(`[Chat] Request failed at ${url} ->`, lastError);
        continue;
      }

      const data = await res.json();
      console.log(`[Chat] Success! Response received from ${url}`);
      return String(data.reply || "").trim();
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? `Request timed out (${REQUEST_TIMEOUT_MS / 1000}s)`
          : error instanceof Error
          ? error.message
          : "Network error";
      console.warn(`[Chat] Error for ${baseUrl}:`, lastError);
    }
  }

  console.log(`[Chat] All endpoints failed. Last error: ${lastError}`);
  
  return `I can help you with:

- Explain Lipinski rules
- What is ADMET?
- What is LogP?
- Show dataset overview
- How does scoring work?
- How to use filters?

Try one of these questions!`;
}

export default function QuantivaAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isOpen]);

  const onSend = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: "user", text };
    const nextHistory = [...messages.slice(-10), userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await fetchChatReply(text, nextHistory);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: reply || "I could not generate a response right now. Please try again.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `I can help you with:\n\n- Explain Lipinski rules\n- How does scoring work?\n- What is ADMET?\n- Show dataset overview\n\nTry one of these questions!`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-5 z-[100] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bot className="h-4 w-4" />
              Quantiva Assistant
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollerRef} className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void onSend(prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "assistant"
                    ? "bg-slate-100 text-slate-700"
                    : "ml-auto bg-indigo-600 text-white"
                }`}
              >
                {m.text}
              </div>
            ))}

            {isLoading && (
              <div className="max-w-[92%] rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                Thinking...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSend();
              }}
              disabled={isLoading}
              placeholder="Ask anything about your drug discovery workflow..."
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-indigo-200 focus:ring"
            />
            <button
              onClick={() => void onSend()}
              disabled={isLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[100] inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700"
        aria-label="Open assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    </>
  );
}