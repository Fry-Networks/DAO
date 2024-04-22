import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
import mongoose from "mongoose";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);

    // Check if user is authenticated and is an admin
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('byods');

    if (req.method === 'PUT') {
        const data: {
           email: string
        } = req.body;


        try {
            await collection.updateOne({ email: data.email }, { $set: { "algo": false, "fry": false } });
            res.status(200).json({ message: "User updated successfully" });
            console.log(`User ${data.email} updated successfully by ${session.user.email}`);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error updating user" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
