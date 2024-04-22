import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import mongoose from "mongoose";
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]";
interface Data {
    device_id: string,
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const session = await getServerSession(req,res, authOptions);
    // Check if user is authenticated
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const data: Data = req.body;

    const { device_id } = data

    const client = await clientPromise;

    const db = client.db();

    const collection = db.collection('devices');

    console.log("device_id", device_id);
    
    const existingDevice = await collection.findOne({
        _id: new mongoose.Types.ObjectId(device_id)
    });

    if (!existingDevice) {
        res.status(404).json({ message: "Device not found" });
        return;
    }

    try {

        
        collection.deleteOne({
            _id:new mongoose.Types.ObjectId(device_id)
        });

        res.status(200).json({ message: "ok" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "error" });
    }

};