import { config } from '../config';

export async function submitByteplusTask(payload: any) {
    const response = await fetch(`${config.byteplus.baseUrl}/api/v3/images/generations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.byteplus.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`BytePlus submission failed (${response.status}): ${text}`);
    }

    return response.json();
}
