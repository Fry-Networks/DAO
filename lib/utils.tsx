'use server'
import DeviceModel, { Device } from './devices-schema';
import UserModel, { User } from './users-schema';
import axios from "axios";
import 'dotenv/config'

export async function getMongoUser({ address, email }: { address?: string, email?: string }): Promise<User> {
    if (email && address) {
        if (await UserModel.exists({ email: email, address: address })) {
            return (await UserModel.findOne({ email: email, address: address }))!;
        } else if (await UserModel.exists({ email: email })) {
            const user = (await UserModel.findOne({ email: email }))!;
            user.address = address;
            await user.save();
            return user;
        } else if (await UserModel.exists({ address: address })) {
            const user = (await UserModel.findOne({ address: address }))!;
            user.email = email;
            await user.save();
            return user;
        } else {
            return await UserModel.create({ email: email, address: address });
        }
    } else if (email) {
        if (await UserModel.exists({ email: email })) {
            return (await UserModel.findOne({ email: email }))!;
        } else {
            return await UserModel.create({ email: email });
        }
    } else if (address) {
        if (await UserModel.exists({ address: address })) {
            return (await UserModel.findOne({ address: address }))!;
        } else {
            return await UserModel.create({ address: address });
        }
    }
    throw new Error("Both email and address are missing");
}

export async function getDevices(): Promise<Device[]> {
    return (await DeviceModel.find({}));
}
//const { email, device_name, api_key, device_type } = req.body;
export async function addDevice({ email, device_type }: { email: string, device_type: string }): Promise<boolean> {
    let device_name = "";

    switch (device_type) {
        case "ODB":
            device_name = "$FRY Outdoor Decibel Miner";
            break;
        case "IDB":
            device_name = "$FRY Indoor Decibel Miner";
            break;
        case "IGPS":
            device_name = "$FRY Indoor Satellite Miner";
            break;
        case "OGPS":
            device_name = "$FRY Outdoor Satellite Miner";
            break;
        case "VPN":
            device_name = "$FRY Bandwidth Miner";
            break;
        default:
            "Unknown Device";
    }

    axios.post("http://fryfoundation.ddns.net:3006/adddevice", {
        email: email,
        device_name: device_name,
        api_key: process.env.BASE_API_KEY,
    }).then((res) => {
        console.log(`statusCode: ${res.status}`);
        console.log(res);
        return true
    }
    ).catch((error) => {
        console.error(error);
        return false
    }
    );
    return false


};
/*
$FRY Outdoor Decibel Miner
$FRY Indoor Decibel Miner
$FRY Indoor Satellite Miner
$FRY Outdoor Satellite Miner
$FRY Bandwidth Miner
*/
