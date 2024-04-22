import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
import mongoose from "mongoose";

interface ProductData {
    productId: string;
    unverifiedReward?: string;
    verifiedReward?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);

    // Check if user is authenticated and is an admin
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('products');

    if (req.method === 'GET') {
        const products = await collection.find().toArray();
        res.status(200).json(products);
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
