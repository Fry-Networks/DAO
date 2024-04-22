

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

    const res = await fetch('/api/add-device', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, device_name, device_type })
    });
    return res.ok;

};

export async function addUser(data: { email: string, address: string, first_name: string, last_name: string }): Promise<boolean> {
    const res = await fetch('/api/add-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return res.ok;
}

export async function removeUser(user_id: string): Promise<boolean> {
    const res = await fetch('/api/remove-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id })
    });
    return res.ok;
}

export async function removeDevice(device_id: string): Promise<boolean> {
    const res = await fetch('/api/remove-device', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_id })
    });
    return res.ok;
}