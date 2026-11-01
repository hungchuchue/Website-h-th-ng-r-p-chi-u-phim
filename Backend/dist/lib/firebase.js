"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemoteConfigBoolean = getRemoteConfigBoolean;
exports.getRemoteConfigNumber = getRemoteConfigNumber;
const app_1 = require("firebase-admin/app");
const remote_config_1 = require("firebase-admin/remote-config");
function getFirebaseServiceAccountJson() {
    return process.env.FIREBASE_SERVICE_ACCOUNT;
}
function getFirebaseApp() {
    if ((0, app_1.getApps)().length > 0) {
        return (0, app_1.getApps)()[0];
    }
    const serviceAccountJson = getFirebaseServiceAccountJson();
    if (!serviceAccountJson) {
        return null;
    }
    try {
        const credentials = JSON.parse(serviceAccountJson);
        return (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(credentials),
        });
    }
    catch (error) {
        console.error('[Firebase] Failed to initialize app:', error.message);
        return null;
    }
}
async function getRemoteConfigBoolean(key) {
    const app = getFirebaseApp();
    if (!app) {
        return null;
    }
    const template = await (0, remote_config_1.getRemoteConfig)(app).getTemplate();
    const parameter = template.parameters[key];
    const value = parameter?.defaultValue && 'value' in parameter.defaultValue
        ? parameter.defaultValue.value
        : undefined;
    if (value === undefined || value === null) {
        return null;
    }
    const normalized = `${value}`.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized))
        return true;
    if (['false', '0', 'no', 'off'].includes(normalized))
        return false;
    return null;
}
async function getRemoteConfigNumber(key) {
    const app = getFirebaseApp();
    if (!app) {
        return null;
    }
    const template = await (0, remote_config_1.getRemoteConfig)(app).getTemplate();
    const parameter = template.parameters[key];
    const value = parameter?.defaultValue && 'value' in parameter.defaultValue
        ? parameter.defaultValue.value
        : undefined;
    if (value === undefined || value === null) {
        return null;
    }
    const parsed = Number(`${value}`.trim());
    return Number.isFinite(parsed) ? parsed : null;
}
