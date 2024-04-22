import mongoose, { mongo } from 'mongoose';
export const weatherAccountsSchema = new mongoose.Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    timestamp: Date,
    api_key: String,
    api_type: String,
    devices: {
        type: [{
            deviceMAC: String,
            infos: {
                coords: {
                    lat: Number,
                    lon: Number
                },
                name: String,
            }
        }],
        default: []
    }
});

export interface weatherAccount extends mongoose.Document {
    user_id: mongoose.Schema.Types.ObjectId | string,
    timestamp: Date,
    api_key: string,
    token: string,
    api_type: string;
    devices: {
        deviceMAC: string,
        infos: {
            coords: {
                lat: number,
                lon: number
            },
            name: string,
        }
    }[]
}

export interface deviceData {
    deviceMAC: string,
    infos: {
        coords: {
            lat: number,
            lon: number
        },
        name: string,
    },
    type: string
}

export const WeatherAccountModel = mongoose.models.weather_accounts || mongoose.model<weatherAccount>('weather_accounts', weatherAccountsSchema) as mongoose.Model<weatherAccount>;
