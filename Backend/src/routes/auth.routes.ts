import { NextFunction, Request, Response, Router } from 'express';
import { adminAuthService } from '../services/auth.service';
import { BaseResponse } from '../types/responses';
import { LoginBodyRequest } from '../types/requests';
const router = Router();

router.post('/login', async (req: Request, res: Response<BaseResponse>, next: NextFunction) => {
  try {
  
    const body: LoginBodyRequest = req.body;
    const result = await adminAuthService.login(body.email, body.password);

    return res.status(200).json({
      code: 200,
      message: 'Login success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };