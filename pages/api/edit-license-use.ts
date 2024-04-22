import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
import mongoose from "mongoose";

interface ProductData {
    productId: string;
    unverifiedReward?: string;
    verifiedReward?: string;
    password: string
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
    const collection = db.collection('byods');

    if (req.method === 'PUT') {
        const data: {
            license: { license: string, used: boolean }, email: string
        } = req.body;




        try {
            await collection.updateOne({ email: data.email }, { $set: { "licenses.$[elem].used": !data.license.used } }, { arrayFilters: [{ "elem.license": data.license.license }] });

            res.status(200).json({ message: "Product updated successfully", used: !data.license.used });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error updating product" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
