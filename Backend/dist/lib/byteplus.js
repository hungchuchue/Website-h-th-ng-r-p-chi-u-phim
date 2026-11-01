"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitByteplusTask = submitByteplusTask;
const config_1 = require("../config");
async function submitByteplusTask(payload) {
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
