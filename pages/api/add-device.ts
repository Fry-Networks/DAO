import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
interface Data {
    email: string,
    device_name: string,
    device_type: string,
}

const api_key = process.env.BASE_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const session = await getServerSession(req,res, authOptions);
    // Check if user is authenticated
    if (!session || !session.user.admin) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    
    const data: Data = req.body;

    const { email, device_name, device_type } = data
    try {
        const apiRes = await axios.post('http://siimon.ddns.net:3006/newdevice', {
            email: email,
            device_name: device_name,
            device_type: device_type,
            api_key: api_key
        });

        console.log(apiRes.status);

        res.status(200).json({ message: "ok" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "error" });
    }
};