import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    refId:     { type: String, required: true },
    eventType: { type: String, default: "" },
    montant:   { type: Number, default: 0 },
    donateur:  {
      prenom: { type: String, default: "" },
      nom:    { type: String, default: "" },
      email:  { type: String, default: "" },
    },
    refHelloAsso: { type: String, default: "" },
    rawData:      { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Donation = mongoose.model("Donation", donationSchema);

export default Donation;
