import mongoose, { mongo } from 'mongoose';
import { connect } from './connect';
export const webUsersSchema = new mongoose.Schema({
    name: String,
    username: String,
    email: String,
    admin: Boolean,
});
export interface webUser extends mongoose.Document {
    name: string;
    username: string;
    email: string;
    admin: boolean;
}

export interface rawWebUser {
    name: string;
    username: string;
    email: string;
    admin: boolean;
}
const WebUserModel = (mongoose.models.webusers || mongoose.model<webUser>('webusers', webUsersSchema)) as mongoose.Model<webUser>;


export default WebUserModel;