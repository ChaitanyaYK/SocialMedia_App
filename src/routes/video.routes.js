// import { Router } from 'express';
// import {
//     deleteVideo,
//     getAllVideos,
//     getVideoById,
//     publishAVideo,
//     togglePublishStatus,
//     updateVideo,
// } from "../controllers/video.controller.js"
// import {verifyJWT} from "../middlewares/auth.middleware.js"
// import {upload} from "../middlewares/multer.middleware.js"

// const router = Router();
// router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file


// router.route("/videos").get(getAllVideos)
// router
//     .route("/")
//     .post(
//         upload.fields([
//             {
//                 name: "videoFile",
//                 maxCount: 1,
//             },
//             {
//                 name: "thumbnail",
//                 maxCount: 1,
//             },
            
//         ]),
//         publishAVideo
//     );

    
// router.route("/videos/:videoId").get(getVideoById)
// router.route("/videos/:videoId").delete(deleteVideo)
    
// router
//     .route("/videos/:videoId")
//     .patch(upload.single("thumbnail"), updateVideo);

// router.route("/videos/publish/:videoId").patch(togglePublishStatus);

// export default router


import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    getSignUrl
} from "../controllers/video.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
            
        ]),
        publishAVideo
    );

router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

router.route("/geturl/:videoId").get(getSignUrl);

export default router;