import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import membersRouter from "./members";
import trainersRouter from "./trainers";
import attendanceRouter from "./attendance";
import plansRouter from "./plans";
import leadsRouter from "./leads";
import broadcastsRouter from "./broadcasts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(membersRouter);
router.use(trainersRouter);
router.use(attendanceRouter);
router.use(plansRouter);
router.use(leadsRouter);
router.use(broadcastsRouter);
router.use(dashboardRouter);

export default router;
