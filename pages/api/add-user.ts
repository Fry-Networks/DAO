import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongoclient";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
interface Data {
    email: string,
    address: string,
    first_name: string,
    last_name: string,
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const session = await getServerSession(req,res, authOptions);
    // Check if user is authenticated
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    
    const data: Data = req.body;

    const { email, address, first_name, last_name } = data

    const client = await clientPromise;

    const db = client.db();

    const collection = db.collection('users');

    const full = first_name && last_name ? first_name + " " + last_name : "";
    try {


        collection.insertOne({
            email: email,
            address: address,
            name: {
                first: first_name,
                last: last_name,
                full: full
            },
            byod: {
                licenses: [],
                payments: []
            }
        });

        res.status(200).json({ message: "ok" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "error" });
    }

};