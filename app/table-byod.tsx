import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text,
  Button,
  Callout,
  TextInput,
  Flex,
  Tab,
  FlexDirection
} from '@tremor/react';
import { webUser } from '../lib/webusers-model';
import { User } from '../lib/users-schema';
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Device } from '../lib/devices-schema';
import { ByodUser } from '../lib/byod-schema';
import { useState } from 'react';


// Your byte sequenc

export default function ByodTable({ byods }: { byods: ByodUser[] }) {
  const [updateSuccess, setUpdateSuccess] = useState(""); // State to track update success
  const [license, setLicense] = useState("");
  const [email, setEmail] = useState("");
  const setUsed = async (license: { license: string, used: boolean }, email: string) => {
    try {
      const response = await fetch('/api/edit-license-use', { // Replace with your actual API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ license, email }),
      });

      if (!response.ok) {
        setUpdateSuccess("error"); // Reset success state
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Updated license use:', result);
      setUpdateSuccess("license"); // Set success state to true
      setTimeout(() => setUpdateSuccess(""), 3000); // Reset success state after 3 seconds
      return result.used;
    } catch (err) {
      console.error('Error updating license use:', err);
    }
  }
  const createLicense = async (license: string, email: string) => {
    try {
      const response = await fetch('/api/add-license', { // Replace with your actual API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ license, email }),
      });

      if (!response.ok) {
        setUpdateSuccess("error"); // Reset success state
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Added license:', result);
      setUpdateSuccess("license"); // Set success state to true
      setTimeout(() => setUpdateSuccess(""), 3000); // Reset success state after 3 seconds
    } catch (err) {
      console.error('Error adding license:', err);
    }
  }
  const resetPayments = async (email: string) => {
    try {
      const response = await fetch('/api/reset-user-payments', { // Replace with your actual API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setUpdateSuccess("error"); // Reset success state
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Reset payments:', result);
      setUpdateSuccess("payments"); // Set success state to true
      setTimeout(() => setUpdateSuccess(""), 3000); // Reset success state after 3 seconds
    } catch (err) {
      console.error('Error resetting payments:', err);
    }
  }
  console.log(byods);
  return (


    <div style={{ width: "100%  " }}>
      <Flex flexDirection='row' justifyContent='evenly' alignItems='center' style={{ marginBottom: "2px" }}>
      <TextInput placeholder="License" style={{ marginTop: "2px" }} onValueChange={(value) => setLicense(value)} />
      <TextInput placeholder="Email" style={{ marginTop: "2px" }} onValueChange={(value) => setEmail(value)} />
      <Button onClick={() => {
        createLicense(license, email);
      }}>Add license</Button>
      </Flex>
      {(updateSuccess != "" && updateSuccess != "error") && (
        <Callout className="mt-4" title="Success" icon={CheckCircleIcon} color="teal">
          Successfully updated {updateSuccess} !
        </Callout>
      )}
      {(updateSuccess == "error") && (
        <Callout className="mt-4" title="Error" icon={CheckCircleIcon} color="red">
          Error updating license!
        </Callout>
      )}
      <Table style={{width: "100%"}}>
      

        <TableHead>
          <TableRow>
            <TableHeaderCell>Email/Address</TableHeaderCell>
            <TableHeaderCell>Licenses</TableHeaderCell>
            <TableHeaderCell>Payments</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {byods.map((byod) => (
            <TableRow key={byod.id}>
              <TableCell>
                <Flex flexDirection='col' justifyContent='start' alignItems='start'>
                  <div>
                {byod.email} 
                </div>
                <div>
                {byod.address ?? "None"}
                </div>
                </Flex>
                </TableCell>
              <TableCell>
                {byod.licenses.map((license_data, index) => {

                  let color: "red" | "green" = license_data.used ? "red" : "green"
                  // Directly using <div> here
                  return (<div key={index} className="license-text">
                    <Flex flexDirection='row' justifyContent='between' alignItems='center'>
                    {license_data.license}
                    <Button
                      color={color}
                      style={{ marginTop: "2px", marginLeft: "2px", marginBottom: "2px" }}
                      onClick={() => {
                        setUsed(license_data, byod.email).then((used) => {
                          color = used ? "red" : "green";
                        });
                      }}>
                      Mark as used
                    </Button>
                    </Flex>
                  </div>
                  );

                })
                }

              </TableCell>
              <TableCell>
                {/* Assuming Text component doesn't need a component prop here */}
                <Flex flexDirection='col' justifyContent='center' alignItems='center'>
                <div>{`Algo: ${byod.algo ? "Yes" : "No"} | Fry: ${byod.fry ? "Yes" : "No"}`}</div>
                <Button
                style={{
                  marginTop: "2px",
                  marginBottom: "2px",
                
                }}
                color='yellow'
                  onClick={() => {
                    resetPayments(byod.email);
                  }}
                >
                  Reset payments
                </Button>
                </Flex>
              </TableCell>
            </TableRow>
          ))}


        </TableBody>
      </Table>
    </div>
  );
}
