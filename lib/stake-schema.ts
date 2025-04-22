import mongoose from 'mongoose';

export interface Stake extends mongoose.Document {
  voteId: object;
  option: string;
  address: string;
  end_date: Date;
  stakes: number;
  votes: number;
}

export const stakeSchema = new mongoose.Schema({
  voteId: Object,
  option: String,
  address: String,
  end_date: Date,
  stakes: Number,
  votes: Number
});
