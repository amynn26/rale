import mongoose from "mongoose";
import crypto   from "crypto";

const newsletterSchema = new mongoose.Schema(
  {
    refId:            { type: String, required: true },
    prenom:           { type: String, required: true },
    email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    active:           { type: Boolean, default: true },
    unsubscribeToken: {
      type:    String,
      unique:  true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },
  },
  { timestamps: true }
);

const Newsletter = mongoose.model("Newsletter", newsletterSchema);

export default Newsletter;
