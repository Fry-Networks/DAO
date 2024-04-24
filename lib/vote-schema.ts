import mongoose from "mongoose";

export interface Vote extends mongoose.Document {
    expires_on: Date;
    total_votes: number;
    createdAt: Date;
    deleted: boolean;
    current: boolean
    title: string;
    description: string;
    votes: [
        {
            id: string;
            option: string;
            description: string;
            title: string;
            votes: number;
            different_people: number;
        }
    ]
    }

export const voteSchema = new mongoose.Schema({
    expires_on: Date,
    total_votes: { type: Number, default: 0},
    createdAt: { type: Date, default: Date.now },
    deleted: { type: Boolean, default: false },
    current: { type: Boolean, default: false },
    title: String,
    description: String,
    votes: [
        {
            option: String,
            description: String,
            title: String,
            votes: { type: Number, default: 0},
            different_people: { type: Number, default: 0}
        }
    ]
});
