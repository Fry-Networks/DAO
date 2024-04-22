import { Button, SearchSelect, SearchSelectItem, Text } from "@tremor/react";
import { getSession } from "next-auth/react";
import { useState } from "react";
import clientPromise from "../lib/mongoclient";
import { User } from "../lib/users-schema";
import { removeDevice } from "./server-util";
import { Device } from "../lib/devices-schema";
export default function RemoveDeviceForm({ devices }: { devices: Device[] }) {
    const [selectedDevice, setSelectedDevice] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    return (
        <div>
            <Text className="mb-4">Select a user and hit the button to remove it</Text>
      
        
                <SearchSelect className=" mb-4" placeholder="Select a user" onValueChange={(value) => setSelectedDevice(value)} value={selectedDevice}>
                    {devices.map((device, index) => (
                        <SearchSelectItem key={index} value={device._id}>
                             {device.miner_key ? `${device.miner_key} (${device.name})` : device.name}
                             </SearchSelectItem>
                    ))}
                </SearchSelect>
       

            {selectedDevice ? (
                 <Button
                 className=""
                 style={{
                   backgroundColor: "RGB(73, 197, 105)"
                 }}
                 loading={isLoading}
                 loadingText="Sending to server..."
                 onClick={async () => {
                    setIsLoading(true);
                    const res = await removeDevice(selectedDevice);
                    if(res) {
                        setStatus("Success");
                    } else {
                        setStatus("Failed..");
                    }
                    setIsLoading(false);
                 }}
               >
                {status ? status : "Send to server"}
                
                </Button>
            )   : ""}
        </div>

    );
};