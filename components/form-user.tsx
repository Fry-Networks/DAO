import { Button, Text, TextInput } from "@tremor/react";

import { useState } from "react";
import { addUser } from "./server-util";

export default function UserForm() {
    const [deviceType, setDeviceType] = useState("");
    const [selectedUser, setSelectedUser] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [data, setData] = useState({
        email: "",
        address: "",
        first_name: "",
        last_name: ""
    });
    const condition = data.email && data.address && ((data.first_name && data.last_name ) || (!data.first_name && !data.last_name));
    //email address name first last full
    return (
        
        <div>
            <Text className="mb-4">Fill out the informations and hit the button to create an user</Text>

            <TextInput className="mb-4" placeholder="Email" onChange={(e) => setData({ ...data, email: e.target.value })} value={data.email} />
            <TextInput className="mb-4" placeholder="Algorand Address" onChange={(e) => setData({ ...data, address: e.target.value })} value={data.address} />
            <TextInput className="mb-4" placeholder="First Name (leave both empty if unknown)" onChange={(e) => setData({ ...data, first_name: e.target.value })} value={data.first_name} />
            <TextInput className="mb-4" placeholder="Last Name (leave both empty if unknown)" onChange={(e) => setData({ ...data, last_name: e.target.value })} value={data.last_name} />



            <Button
                 className=""
                 style={{
                   backgroundColor: condition ? "RGB(73, 197, 105)" : "RGB(242, 67, 55)"
                 }}
                 loading={isLoading}
                 loadingText="Sending to server..."
                 disabled={!condition}
                 onClick={async () => {
                    setIsLoading(true);
                    const res = await addUser(data);
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
        </div>

            
      

    );
};