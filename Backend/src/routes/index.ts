import { Router } from 'express';
import { adminRouter } from './auth.routes';


const apiRouter = Router();

apiRouter.use('/auth', adminRouter);

export default apiRouter;
