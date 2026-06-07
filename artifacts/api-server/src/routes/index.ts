import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import songsRouter from "./songs";
import videosRouter from "./videos";
import artistsRouter from "./artists";
import labelsRouter from "./labels";
import playlistsRouter from "./playlists";
import commentsRouter from "./comments";
import favoritesRouter from "./favorites";
import submissionsRouter from "./submissions";
import libraryRouter from "./library";
import homeRouter from "./home";
import discoverRouter from "./discover";
import companyRouter from "./company";
import adminRouter from "./admin";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(songsRouter);
router.use(videosRouter);
router.use(artistsRouter);
router.use(labelsRouter);
router.use(playlistsRouter);
router.use(commentsRouter);
router.use(favoritesRouter);
router.use(submissionsRouter);
router.use(libraryRouter);
router.use(homeRouter);
router.use(discoverRouter);
router.use(companyRouter);
router.use(adminRouter);
router.use(paymentsRouter);

export default router;
