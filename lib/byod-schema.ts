import mongoose from "mongoose";

export interface ByodUser extends mongoose.Document {
    licenses: {license: string, used: boolean}[];
    payments: string[];
    address: string;
    email: string;
    algo: boolean;
    fry: boolean;
    }