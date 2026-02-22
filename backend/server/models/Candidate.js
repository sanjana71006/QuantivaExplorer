import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    candidate_id: { type: String, unique: true, required: true, index: true },
    source_dataset: { type: String, required: true, index: true },
    name: { type: String, required: true },
    smiles: { type: String },
    molecular_weight: { type: Number },
    polar_area: { type: Number },
    xlogp: { type: Number },
    h_bond_donor_count: { type: Number },
    h_bond_acceptor_count: { type: Number },
    rotatable_bond_count: { type: Number },
    binding_score: { type: Number },
    toxicity: { type: Number },
    stability: { type: Number },
    solubility: { type: Number },
    efficacy_index: { type: Number, index: true },
    safety_index: { type: Number, index: true },
    molecular_complexity: { type: Number },
    drug_score: { type: Number, index: true },
    priority_rank: { type: Number, index: true },
  },
  { timestamps: true, collection: "candidates" }
);

// Compound index for common queries
candidateSchema.index({ drug_score: -1, source_dataset: 1 });
candidateSchema.index({ source_dataset: 1, safety_index: -1 });
candidateSchema.index({ source_dataset: 1, efficacy_index: -1 });

export const Candidate = mongoose.model("Candidate", candidateSchema);
