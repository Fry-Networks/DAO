import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
import mongoose from "mongoose";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);

    // Check if user is authenticated and is an admin
    if (!session || !session.user.admin || !session.user.owner) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('configs');

    if (req.method === 'PUT') {
        const data: { multiplier: number } = req.body;
        const { multiplier } = data;


        console.log("Updating mutiplier to ", multiplier);
        console.log(`Mult updated successfully by ${session.user.email}`);
        try {
            await collection.updateOne({ name: "rewards" }, { $set: { multiplier: multiplier } });

            res.status(200).json({ message: "Multiplier updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error updating multiplier" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
