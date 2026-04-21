import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    refId:     { type: String, required: true },
    nom:       { type: String, required: true },
    prenom:    { type: String, required: true },
    email:     { type: String, required: true },
    telephone: { type: String, default: "" },
    sujet:     { type: String, required: true },
    message:   { type: String, required: true },
  },
  { timestamps: true }
);

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
