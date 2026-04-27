import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    refId:    { type: String, required: true, unique: true },
    methode:  { type: String, enum: ["virement", "cheque"], default: "virement" },
    montant:  { type: Number, default: 0, min: 0 },
    donateur: {
      prenom: { type: String, default: "", maxlength: 100 },
      nom:    { type: String, default: "", maxlength: 100 },
      email:  { type: String, default: "", maxlength: 200 },
    },
    statut: {
      type:    String,
      enum:    ["en_attente", "reçu", "annulé"],
      default: "en_attente",
    },
    notes: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

donationSchema.index({ statut: 1 });
donationSchema.index({ createdAt: -1 });

const Donation = mongoose.model("Donation", donationSchema);

export default Donation;
