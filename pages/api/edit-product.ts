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
    if (!session || !session.user.admin || !session.user.owner) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('products');

    if (req.method === 'PUT') {
        const data: ProductData = req.body;
        const { productId, unverifiedReward, verifiedReward } = data;
        
        
        console.log("Updating product", productId);

        const existingProduct = await collection.findOne({
            wix_id: productId
        });

        if (!existingProduct) {
            res.status(404).json({ message: "Product not found" });
            return;
        }

        try {
            // Construct an update object
            const updateData: any = {};
            if (unverifiedReward !== undefined) updateData['reward.unverified'] = +unverifiedReward;
            if (verifiedReward !== undefined) updateData['reward.verified'] = +verifiedReward;

            // Update the product in the database
            await collection.updateOne({ wix_id: productId }, { $set: updateData });

            res.status(200).json({ message: "Product updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error updating product" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
