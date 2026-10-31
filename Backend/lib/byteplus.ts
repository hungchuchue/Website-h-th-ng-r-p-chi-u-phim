import { config } from '../src/config';

export async function submitByteplusTask(payload: unknown) {
    if (!config.byteplus.baseUrl || !config.byteplus.apiKey) {
        throw new Error('BYTEPLUS_BASE_URL and BYTEPLUS_API_KEY are required to submit BytePlus tasks');
    }
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
