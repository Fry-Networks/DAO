import mongoose, { mongo } from "mongoose";
 const AirAccountSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  timestamp: Date,
  api_type: String,
  devices: [String],
});

export const AirAccountModel = mongoose.model('air_accounts', AirAccountSchema);

export interface AirAccount extends mongoose.Document {
  user_id: mongoose.Schema.Types.ObjectId | string;
  timestamp: Date;
  api_type: API_TYPE;
  api_key?: string;
  read_key?: string;
  sensor?: string;
  owner?: string;
  imei?: string;
  info: String;
  devices?: Array<any>;
}
const PurpleAirSchema = new mongoose.Schema({
  read_key: { type: String, required: true },
  sensor: { type: String, required: true }
});
export const PurpleAirModel = AirAccountModel.discriminator('purpleAir_acc', PurpleAirSchema);

const AmbientSchema = new mongoose.Schema({
   api_key: { type: String, required: true },
});
export const AmbientModel = AirAccountModel.discriminator('ambient_acc', AmbientSchema);

const EcowittSchema = new mongoose.Schema({
  api_key: { type: String, required: true },
});

export const EcowittModel = AirAccountModel.discriminator('ecowitt_acc', EcowittSchema);

const PebbleSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  imei: { type: String, required: true },
});

export const PebbleModel = AirAccountModel.discriminator('pebble_acc', PebbleSchema);


export interface PurpleAirAccount extends AirAccount {
  api_type: "purple-air";
  read_key: string;
  sensor: string;
}
export interface AmbientAccount extends AirAccount {
  api_type: "ambient";
  api_key: string;
}
export interface PebbleAccount extends AirAccount {
  api_type: "pebble";
  owner: string;
  imei: string;
}
export interface EcowittAccount extends AirAccount {
  api_type: "ecowitt";
  api_key: string;
  app_key: string;
}


type API_TYPE = "purple-air" | "ambient" | "pebble" | "ecowitt";

export default AirAccountSchema