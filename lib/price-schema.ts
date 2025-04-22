import mongoose from 'mongoose';

export interface Price extends mongoose.Document {
  no: number;
  project_name: string;
  price: number;
  asset_id: string;
  isUSD: boolean;
}

export const priceSchema = new mongoose.Schema({
  no: Number,
  project_name: String,
  price: Number,
  asset_id: String,
  isUSD: Boolean
});
