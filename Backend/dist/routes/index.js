"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const apiRouter = (0, express_1.Router)();
apiRouter.use('/auth', auth_routes_1.adminRouter);
exports.default = apiRouter;
//# sourceMappingURL=index.js.map