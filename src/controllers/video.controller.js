import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary, cloudinary } from "../utils/cloudinary.js";
import { getPublicIdFromUrl } from "../utils/deleteCloudinaryFile.js";
// import { redis } from "../utils/redis.js";
// import { VIWE_TTL_MINUTES } from "../constants.js";


function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = "desc", userId = req.user.id } = req.query
    //TODO: get all videos based on query, sort, pagination

    
    // Build filter object
    const filter = {
        isPublished: true, // Only published videos by default
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    if (userId && isValidObjectId(userId)) {
        filter.owner = userId; // To fetch a specific user's videos
        delete filter.isPublished; // Show all videos if it's owner viewing
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortType === "asc" ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Query videos
    const videos = await Video.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("owner", "username avatar"); // Optional: populate owner info

    // Count total matching videos
    const totalVideos = await Video.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            videos,
            pagination: {
                total: totalVideos,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalVideos / limit)
            }
        }, "Videos fetched successfully")
    );
});



const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, isPublished = false} = req.body;
    // TODO: get video, upload to cloudinary, create video

    if ((title.trim() === "" || description.trim() === "")) {
        throw new ApiError(400, "All filed are required");
    }

    
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    
    let thumbnailLocalPath
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    }

    console.log("FILES RECEIVED:", req.files);
    console.log("videoFile:", req.files?.videoFile);
    console.log("thumbnail:", req.files?.thumbnail);

    // if (!req.files || !Array.isArray(req.files.videoFile) || !Array.isArray(req.files.thumbnail) || !req.files.videoFile.length || !req.files.thumbnail.length) {
    //     throw new ApiError(400, "Video file and thumbnail are required");
    // }
    if(!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail file required");
        
    }
    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video files required");
    }

    const videoUpload = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);

    console.log("videoUpload:", videoUpload);
    console.log("thumbnailUpload:", thumbnailUpload);

    const durationInSecond = videoUpload.duration;
    const formattedDuration = formatDuration(durationInSecond);
    console.log("Duration:", formattedDuration);

    if (!videoUpload || !videoUpload.url || !thumbnailUpload || !thumbnailUpload.url) {
        throw new ApiError(500, "Error uploading files to Cloudinary");
    }

    const video = await Video.create({
        title,
        description,
        isPublished,
        videoFile: videoUpload.url,
        thumbnail: thumbnailUpload.url,
        duration: formattedDuration,
        owner: req.user._id
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
        throw new ApiError(400, "Invalid video Id")
    }

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

    const getVideo = await Video.findById(videoId).populate("owner", "username avatar")

    if (!getVideo) {
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(new ApiResponse(200, getVideo, "Current Video fetched successfully"))  
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: update video details like title, description, thumbnail

    const {title, description} = req.body;

    if (!title || !description) {
        throw new ApiError(400, "title or description not found")
    }

    const existingVideo = await Video.findById(videoId);
    if (!existingVideo) {
        throw new ApiError(404, "Video not found");
    }

    if (req.user._id.toString() !== existingVideo.owner.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    console.log("Received file:", req.file);

    const thumbnailLocalPath = req.file?.path

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file not found");
    }
    
    // Upload new thumbnail image to Cloudinary
    let thumbnailUrl = undefined;
    if (thumbnailLocalPath) {
        const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);
        
        console.log("Cloudinary upload result:", thumbnailUpload);
        
        if (!thumbnailUpload?.url) {
            throw new ApiError(500, "Error uploading the thumbnail file");
        }
        thumbnailUrl = thumbnailUpload.url;
    }

    
    // If Video has an previous thumbnail, delete it from Cloudinary
    if (existingVideo?.thumbnail) {
        const publicId = await getPublicIdFromUrl(existingVideo.thumbnail);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
            console.log("Delete previous thumbnail:", publicId);
            
        }
    }
    
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                ...(thumbnailUrl && {thumbnail: thumbnailUrl}),
            }
        },
        { new: true }
    );
    // .select("-video")

    if (!video) {
        throw new ApiError(404, "video not found")
    }

    return res.status(200).json(new ApiResponse(200, {video}, "Video updated successfully"))
})


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: delete video

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found to Delete")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // Delete video file from Cloudinary
    if (video?.videoFile) {
        const videoPublicId = getPublicIdFromUrl(video.videoFile, {resource_type: "video"})
        if (videoPublicId) {
            await cloudinary.uploader.destroy(videoPublicId)
        }
    }

    // Delete thumbnail file from Cloudinary
    if (video?.thumbnail) {
        const thumbnailPublicId = getPublicIdFromUrl(video.thumbnail)
        if (thumbnailPublicId) {
            await cloudinary.uploader.destroy(thumbnailPublicId)
        }
    }

    // Delete from MongoDB
    const deletedVideo  = await Video.findByIdAndDelete(videoId)

    return res.status(200)
    .json(new ApiResponse(200, deletedVideo, "Video deleted successfully"))
})


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

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