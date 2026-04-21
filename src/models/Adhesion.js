import mongoose from "mongoose";

const adhesionSchema = new mongoose.Schema(
  {
    refId:        { type: String, required: true },
    nom:          { type: String, required: true },
    prenom:       { type: String, required: true },
    email:        { type: String, required: true },
    telephone:    { type: String, required: true },
    adresse:      { type: String, required: true },
    codePostal:   { type: String, required: true },
    ville:        { type: String, required: true },
    typeAdhesion: {
      type: String,
      required: true,
      enum: ["individuel", "famille", "bienfaiteur"],
    },
    motivation: { type: String, default: "" },
    statut:     {
      type: String,
      default: "en_attente",
      enum: ["en_attente", "validé", "refusé"],
    },
  },
  { timestamps: true }
);

const Adhesion = mongoose.model("Adhesion", adhesionSchema);

export default Adhesion;
