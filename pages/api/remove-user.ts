import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import mongoose from "mongoose";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
interface Data {
    user_id: string,
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const session = await getServerSession(req,res, authOptions);
    // Check if user is authenticated
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const data: Data = req.body;

    const { user_id } = data

    const client = await clientPromise;

    const db = client.db();

    const collection = db.collection('users');

    console.log("user_id", user_id);
    
    const existingUser = await collection.findOne({
        _id: new mongoose.Types.ObjectId(user_id)
    });

    if (!existingUser) {
        res.status(404).json({ message: "User not found" });
        return;
    }

    try {

        
        collection.deleteOne({
            _id:new mongoose.Types.ObjectId(user_id)
        });

        res.status(200).json({ message: "ok" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "error" });
    }

};