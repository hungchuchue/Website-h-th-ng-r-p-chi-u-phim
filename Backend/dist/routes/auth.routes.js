"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_service_1 = require("../services/auth.service");
const router = (0, express_1.Router)();
exports.adminRouter = router;
router.post('/login', async (req, res, next) => {
    try {
        const body = req.body;
        const result = await auth_service_1.adminAuthService.login(body.email, body.password);
        return res.status(200).json({
            code: 200,
            message: 'Login success',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=auth.routes.js.map