"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_autogen_1 = __importDefault(require("swagger-autogen"));
const path_1 = __importDefault(require("path"));
const __dirname = path_1.default.dirname(__filename);
const doc = {
    info: {
        title: 'AI Gen Image API',
        version: '1.0.0',
        description: 'Tài liệu API cho hệ thống tạo Hình ảnh bằng AI',
    },
    basePath: "/",
    schemes: ['http', 'https'],
};
const outputFile = path_1.default.join(__dirname, 'swagger_output.json');
const endpointsFiles = [path_1.default.join(__dirname, '../../src/app.ts')];
(0, swagger_autogen_1.default)()(outputFile, endpointsFiles, doc)
    .then(() => {
    console.log('✅ Swagger JSON đã được tạo thành công!');
});
