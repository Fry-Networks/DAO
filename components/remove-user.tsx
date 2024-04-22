import { Button, SearchSelect, SearchSelectItem, Text } from "@tremor/react";
import { getSession } from "next-auth/react";
import { useState } from "react";
import clientPromise from "../lib/mongoclient";
import { User } from "../lib/users-schema";
import { addDevice, removeUser } from "./server-util";
export default function RemoveUserForm({ users }: { users: User[] }) {
    const [selectedUser, setSelectedUser] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    return (
        <div>
            <Text className="mb-4">Select a user and hit the button to remove it</Text>
      
        
                <SearchSelect className=" mb-4" placeholder="Select a user" onValueChange={(value) => setSelectedUser(value)} value={selectedUser}>
                    {users.map((user, index) => (
                        <SearchSelectItem key={index} value={user._id}>
                             {user.name?.full ? `${user.name?.full} (${user.email})` : user.email}
                             </SearchSelectItem>
                    ))}
                </SearchSelect>
       

            {selectedUser ? (
                 <Button
                 className=""
                 style={{
                   backgroundColor: "RGB(73, 197, 105)"
                 }}
                 loading={isLoading}
                 loadingText="Sending to server..."
                 onClick={async () => {
                    setIsLoading(true);
                    const res = await removeUser(selectedUser);
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