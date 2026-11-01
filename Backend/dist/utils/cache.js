"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cache_1 = __importDefault(require("node-cache"));
// Cache giữ dữ liệu trong 5 phút mặc định, check hết hạn mỗi 1 phút
const cache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60 });
exports.default = cache;
