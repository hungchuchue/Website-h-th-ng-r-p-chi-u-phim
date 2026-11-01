import { Router } from 'express';
import { adminRouter } from './auth.routes';
import { cinemaRouter } from './cinema.routes';


const apiRouter = Router();

apiRouter.use('/auth', adminRouter);
apiRouter.use((req, res, next) => {
  /* #swagger.ignore = true */
  cinemaRouter(req, res, next);
});

export default apiRouter;
