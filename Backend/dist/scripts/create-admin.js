"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prompts_1 = require("@inquirer/prompts");
const validation_1 = require("../utils/validation");
async function main() {
    if (!process.stdin.isTTY)
        throw new Error('Run this command in an interactive terminal.');
    const identifier = await (0, prompts_1.input)({ message: 'ADMIN_EMAIL (email hoặc định danh admin):', validate: value => Boolean(value.trim()) || 'Không được để trống.' });
    const secret = await (0, prompts_1.password)({ message: 'Mật khẩu admin:', mask: '*', validate: value => value.length > 0 && value.length <= 128 || 'Mật khẩu phải dài 1–128 ký tự.' });
    const confirmation = await (0, prompts_1.password)({ message: 'Nhập lại mật khẩu:', mask: '*' });
    if (secret !== confirmation)
        throw new Error('Password confirmation does not match.');
    console.log('Copy these settings into Backend/.env. No existing file was changed:');
    console.log('ADMIN_EMAIL=' + identifier.trim().toLowerCase());
    console.log('ADMIN_PASSWORD=' + (0, validation_1.hashPassword)(secret));
}
void main().catch(error => {
    console.error(error instanceof Error && error.name !== 'ExitPromptError' ? error.message : 'Admin configuration cancelled.');
    process.exitCode = 1;
});
//# sourceMappingURL=create-admin.js.map