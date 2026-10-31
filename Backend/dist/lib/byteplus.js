"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitByteplusTask = submitByteplusTask;
const config_1 = require("../src/config");
async function submitByteplusTask(payload) {
    if (!config_1.config.byteplus.baseUrl || !config_1.config.byteplus.apiKey) {
        throw new Error('BYTEPLUS_BASE_URL and BYTEPLUS_API_KEY are required to submit BytePlus tasks');
    }
    const response = await fetch(`${config_1.config.byteplus.baseUrl}/api/v3/images/generations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config_1.config.byteplus.apiKey}`,
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
//# sourceMappingURL=byteplus.js.map