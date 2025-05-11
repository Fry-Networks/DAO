import mongoose from 'mongoose';

export interface Stake extends mongoose.Document {
  voteTitle: string;
  voteOption: string;
  address: string;
  end_date: Date;
  stakes: number;
  votes: number;
  assetId: string;
  withdraw?: boolean;
}

export const stakeSchema = new mongoose.Schema({
  voteTitle: String,
  voteOption: String,
  address: String,
  end_date: Date,
  stakes: Number,
  votes: Number,
  assetId: String,
  withdraw: Boolean
});
