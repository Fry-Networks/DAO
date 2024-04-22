import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
import mongoose from "mongoose";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);

   
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('byods');

    if (req.method === 'PUT') {
        const data: {
            license: string, email: string
        } = req.body;


        console.log(data);
        
        try {
            await collection.updateOne({ email: data.email }, {
                $push: {
                    licenses: {
                        license: data.license,
                        used: false
                    }
                }
            });

            console.log(`License ${data.license} added successfully by ${session.user.email}`);
            res.status(200).json({ message: "License added successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error adding license" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}
