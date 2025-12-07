import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary, cloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { getPublicIdFromUrl } from "../utils/deleteCloudinaryFile.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";

// import { redis } from "../utils/redis.js";
// import { VIWE_TTL_MINUTES } from "../constants.js";


function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// const getAllVideos = asyncHandler(async (req, res) => {
//     const { page = 1, limit = 10, query = "", sortBy = "newest", sortType = "desc", userId } = req.query
//     //TODO: get all videos based on query, sort, pagination

    
//     // // Build filter object
//     // const filter = {
//     //     isPublished: true, // Only published videos by default
//     //     $or: [
//     //         { title: { $regex: query, $options: "i" } },
//     //         { description: { $regex: query, $options: "i" } }
//     //     ]
//     // };
    
//     // // if (userId && isValidObjectId(userId)) {
//     // //     filter.owner = userId; // To fetch a specific user's videos
//     // //     delete filter.isPublished; // Show all videos if it's owner viewing
//     // // }

//     // for using Full Text based search u need to create a search index in mongoDB atlas
//     // you can include field mapppings in search index eg.title, description, as well
//     // Field mappings specify which fields within your documents should be indexed for text search.
//     // this helps in seraching only in title, desc providing faster search results
//     // here the name of search index is 'search-videos'

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//         throw new ApiError(400, "Invalid UserId");
//     }


//     // Build sort object
//     let sort = {};
//     if (sortBy === "oldest") sort = {createdAt: 1};
//     else if(sortBy === "popular") sort = { views: -1 };
//     else sort = {createdAt: -1};

    

//   // Pagination
//     const skip = (parseInt(page) - 1) * parseInt(limit);
  
//         const videos = Video.aggregate([
//             {
//                 $search:{
//                     index: "searchVideos",
//                     text: {
//                         query: query,
//                         path: ["title", "description"]
//                     }
//                 }
//             },
//             {
//                 $match: {
//                     owner: new mongoose.Types.ObjectId(userId)
//                 }
//             },
//             {$match: { isPublished: true }},
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "owner",
//                     foreignField: "_id",
//                     as: "ownerDetails",
//                         pipeline: [
//                             {
//                                 $project: {
//                                     username: 1,
//                                     avatar: 1
//                                 }
//                             }
//                         ]
//                     }
//             },
//             {
//                 $unwind: "$ownerDetails"
//             },
//             {$sort: sort},
//             { $skip: skip }, { $limit: parseInt(limit) }
//         ])


//     // Count total matching videos
//     const totalVideos = await Video.countDocuments({
//             $or: [
//                 { isPublished: true },
//                 { owner: new mongoose.Types.ObjectId(userId) }
//             ]
//         });

//     res.status(200).json(
//         new ApiResponse(200, {
//             videos,
//             pagination: {
//                 totalVideos,
//                 page: parseInt(page),
//                 limit: parseInt(limit),
//                 totalPages: Math.ceil(page)
//             }
//         }, "Videos fetched successfully")
//     );
// });


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query = "", sortBy = "newest", userId = ""} = req.query;

  const pipeline = [];

   
    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'

    // Search using MongoDB Search
    if (query) {
        pipeline.push({
        $search: {
            index: "searchVideos",
            text: {
                query: query,
                path: ["title", "description"]
            }
        }
        });
    }

    // Show published videos otherwise videos of that specific user
    if (userId) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid UserId");
        }
        
        pipeline.push({ 
            $match: {
                $or: [
                    { isPublished: true },
                    { owner: new mongoose.Types.ObjectId(userId) }
                ]
            }
        })
    } else {
        pipeline.push({ $match: { isPublished: true }})
    }

    //  Sort
    let sort = {};
    if (sortBy === "oldest") sort = { createdAt: 1 };
    else if (sortBy === "popular") sort = { views: -1 };
    else sort = { createdAt: -1 };

    pipeline.push({ $sort: sort });

    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "ownerDetails",
            pipeline: [
            { $project: { username: 1, avatar: 1 } }
            ]
        }
        },
        { $unwind: "$ownerDetails" }
    );

    const videos = await Video.aggregate(pipeline);

    const filter = userId ? {
        $or: [
            {isPublished: true},
            {owner: new mongoose.Types.ObjectId(userId)}
        ]
    } : { isPublished: true };

    // count videos
    const totalVideos = await Video.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
        videos,
        pagination: {
            totalVideos,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalVideos/limit),
        }
        }, "Videos fetched successfully")
    );
});



const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, isPublished = false} = req.body;
    // TODO: get video, upload to cloudinary, create video

    if (!title || title.trim() === "") {
        throw new ApiError(400, "Title is required");
    }

    
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    let thumbnailLocalPath
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    }

    // console.log("FILES RECEIVED:", req.files);
    // console.log("videoFile:", req.files?.videoFile);
    // console.log("thumbnail:", req.files?.thumbnail);

     let videoUpload, thumbnailUpload;
    try {
        videoUpload = await uploadOnCloudinary(videoFileLocalPath);

        if (thumbnailLocalPath) {
            thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);
        }
    } catch (err) {
        throw new ApiError(500, "Error while uploading files to Cloudinary");
    }

    // console.log("videoUpload:", videoUpload);
    // console.log("thumbnailUpload:", thumbnailUpload);

    const durationInSecond = videoUpload.duration;
    const formattedDuration = formatDuration(durationInSecond);
    console.log("Duration:", formattedDuration);

    if (!videoUpload || !videoUpload.url) {
        throw new ApiError(500, "Error while uploading video files to Cloudinary");
    }
    if (!thumbnailUpload || !thumbnailUpload.url) {
        throw new ApiError(500, "Error while uploading thumbnail files to Cloudinary");
    }

    const video = await Video.create({
        title,
        description,
        isPublished,
        videoFile: {
            url: videoUpload.url,
            public_id: videoUpload.public_id
        },
        thumbnail: {
            url: thumbnailUpload.url,
            public_id: thumbnailUpload.public_id
        },
        duration: formattedDuration,
        owner: req.user?._id
    })

    if (!video) {
        throw new ApiError(500, "Something went wrong while publishing the Video");
    }

    return res.status(201)
    .json(new ApiResponse(200, video, "Video published successfully"));
})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    // const userId = req.user?.id?.toString();
    // const ip = req.ip;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId")
    }

    const video = await Video.aggregatePaginate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscibersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in:[
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false,
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscibersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                comment: 1,
                likesCount: 1,
                isLiked: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ])

    if (!video) {
        throw new ApiError(500, "failed to fetch video");
    }

    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: new mongoose.Types.ObjectId(videoId)
        }
    })

    // const redisKey = userId
    //     ? `view:user:${userId}:video:${videoId}`
    //     : `view:ip:${ip}:video:${videoId}`;

    // // Check if view already counted recently
    // const hasViewed = await redis.get(redisKey);

    // if (!hasViewed) {
    //     // Increment views only if not already viewed
    //     await Video.findByIdAndUpdate(videoId, {$inc: { views: 1 }})

    //     // Set Redis key with TTL
    //     await redis.set(redisKey, "viewed", "EX", VIWE_TTL_MINUTES * 60)
    // }

    return res.status(200).json(new ApiResponse(200, video.docs, "Current Video fetched successfully"))  
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: update video details like title, description, thumbnail

    const {title, description} = req.body;

    if (!title || !description) {
        throw new ApiError(400, "title or description not found")
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (req.user._id.toString() !== video.owner.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }
    // console.log("Received file:", req.file);

    const thumbnailToDelete = video.thumbnail.public_id;

    const thumbnailLocalPath = req.file?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file not found");
    }
    
    // Upload new thumbnail image to Cloudinary
    const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);
    // console.log("Cloudinary upload result:", thumbnailUpload);
        
    if (!thumbnailUpload?.url){
        throw new ApiError(500, "Error in uploading the thumbnail file");
    }
    
    const updateVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                // ...(thumbnailUrl && {thumbnail: thumbnailUrl}),
                thumbnail: {
                    public_id: thumbnailUpload.public_id,
                    url: thumbnailUpload.url,
                }
            }
        },
        { new: true }
    );
    

    if (!updateVideo) {
        throw new ApiError(404, "Failed to update the video please try again!");
    }

    if (updateVideo) {
            await deleteOnCloudinary(thumbnailToDelete);
    }

    return res.status(200).json(new ApiResponse(200, {updateVideo}, "Video updated successfully"));
})


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: delete video

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found to Delete")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // Delete video file from Cloudinary
    if (video?.videoFile) {
        await deleteOnCloudinary(video.videoFile.public_id, "video")
    }

    // Delete thumbnail file from Cloudinary
    if (video?.thumbnail) {
        await deleteOnCloudinary(video.thumbnail.public_id)
    }

    // Delete from MongoDB
    const deletedVideo  = await Video.findByIdAndDelete(video._id)

    if (!deleteVideo) {
        throw new ApiError(400, "Failed to delete video please try again");
    }

    // delete video likes
    await Like.deleteMany({
        video: videoId
    })

    // delete video comments
    await Comment.deleteMany({
        video: videoId
    })

    return res.status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"))
})


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video not found")
    }

    if (req.user._id.toString() !== video.owner.toString()) {
        throw new ApiError(403, "You are not authorized to published this video");
    }


    video.isPublished = !video.isPublished

    await video.save({validateBeforeSave: false})

    return res.status(200)
    .json(new ApiResponse(200, video, `Video ${video.isPublished ? "published" : "unpublished"} successfully`))
})

// const addWatchHistory = asyncHandler(async(req, res) => {
//     const { videoId } = req.params;

//     const user = await User.findById(req.user._id);

//     if(!user) {
//         throw new ApiError(404, "User not Found");
//     }

//     // Prevent duplicate entries (optional)
//     const videoPresent = user.watchHistory.find((entry) => {
//         entry.video.toString() === videoId
//     });

//     if (videoPresent) {
//         // Update timestamp instead of pushing duplicate
//         videoPresent.watchedAt = new Date();
//     } else {
//         user.watchHistory.push({ video: videoId, watchedAt: new Date() });
//     }

//     await user.save();

//     return res.status(200).json(
//         new ApiResponse(200, user.watchHistory, "Watch history updated successfully")
//     );
// });

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}

// This output of "req.file"
// Received file: {
//   fieldname: 'thumbnail',
//   originalname: 'Ganesha.jpg',
//   encoding: '7bit',
//   mimetype: 'image/jpeg',
//   destination: './public/temp',
//   filename: 'Ganesha.jpg',
//   path: 'public\\temp\\Ganesha.jpg',
//   size: 208978
// }

// This is output of "thumbnailUpload" after uploaded on Cloudinary
// Cloudinary upload result: {
//   asset_id: '9cc35f3726c578e39226031588adb927',
//   public_id: 'videotube/mbgbbbsjekwkxeei57bm',
//   version: 1751608149,
//   version_id: 'a6391c7c0cffe05a608784b79241bd50',
//   signature: 'e8fd7af8706583649551b86829c7e94b006959b2',
//   width: 346,
//   height: 340,
//   format: 'png',
//   resource_type: 'image',
//   created_at: '2025-07-04T05:49:09Z',
//   tags: [],
//   bytes: 208978,
//   type: 'upload',
//   etag: 'f3dd35cb1c54431e31ccccd80b53cce4',
//   placeholder: false,
//   url: 'http://res.cloudinary.com/dqynbwfx7/image/upload/v1751608149/videotube/mbgbbbsjekwkxeei57bm.png',
//   secure_url: 'https://res.cloudinary.com/dqynbwfx7/image/upload/v1751608149/videotube/mbgbbbsjekwkxeei57bm.png',
//   asset_folder: 'videotube',
//   display_name: 'mbgbbbsjekwkxeei57bm',
//   original_filename: 'Ganesha',
//   original_extension: 'jpg',
//   api_key: '428156393432944'
// }

// output of getVideo
// {
//     "statusCode": 200,
//     "message": "Current Video fetched successfully",
//     "data": {
//         "_id": "686959929de304cbd4b4779d",
//         "videoFile": "http://res.cloudinary.com/dqynbwfx7/video/upload/v1751734715/videotube/glljfoe7syia8pijdxsd.mp4",
//         "thumbnail": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1751735124/videotube/kwakufxrypsblvb5bsll.png",
//         "title": "updated title7",
//         "description": "updated description7",
//         "duration": "0:01",
//         "views": 0,
//         "isPublished": false,
//         "owner": {
//             "_id": "6826f66c4fe0436991c7e6a7",
//             "username": "one",
//             "avatar": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1750875333/videotube/pz96qxm97nwxeqbp5znk.png"
//         },
//         "createdAt": "2025-07-05T16:57:54.671Z",
//         "updatedAt": "2025-07-05T17:04:39.490Z",
//         "__v": 0
//     },
//     "success": true
// }

// output of deletedVideo
// {
//     "statusCode": 200,
//     "message": "Video deleted successfully",
//     "data": {
//         "_id": "686959929de304cbd4b4779d",
//         "videoFile": "http://res.cloudinary.com/dqynbwfx7/video/upload/v1751734715/videotube/glljfoe7syia8pijdxsd.mp4",
//         "thumbnail": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1751735124/videotube/kwakufxrypsblvb5bsll.png",
//         "title": "updated title7",
//         "description": "updated description7",
//         "duration": "0:01",
//         "views": 0,
//         "isPublished": false,
//         "owner": "6826f66c4fe0436991c7e6a7",
//         "createdAt": "2025-07-05T16:57:54.671Z",
//         "updatedAt": "2025-07-05T17:04:39.490Z",
//         "__v": 0
//     },
//     "success": true
// }