import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
// // Create a Reusable Toggle function
// const toggleLike = async ({ entityId, entityType, userId }) => {
//     let query = {};
//     query[entityType] = entityId;

//     const existingLike = await Like.findOne({ ...query, likedBy: userId });

//     if (existingLike) {
//         await existingLike.deleteOne();
//         const likeCount = await Like.countDocuments(query);
//         return { liked: false, likeCount };
//     }

//     await Like.create({ ...query, likedBy: userId });
//     const likeCount = await Like.countDocuments(query);
//     return { liked: true, likeCount };
// };

// // Uses :- return this result in responce directly
// // const result = await toggleLike({ entityId: videoId, entityType: "video", userId });

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    const userId = req.user?._id;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const isLiked = await Like.findOne({ video: videoId, likedBy: userId});

    if (isLiked) {
       await isLiked.deleteOne();

    //    const likeCount = await Like.countDocuments({video: videoId});

       return res.status(200).json(new ApiResponse(200, {liked: false}, "Video disliked successfully"))
    }

    await Like.create({ video: videoId, likedBy: userId });

    // const likeCount = await Like.countDocuments({video: videoId});

    return res.status(201)
    .json(new ApiResponse(200, {liked: true}, "Video liked successfully"))
    
})


const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params;
    //TODO: toggle like on comment

    const userId = req.user?._id;

    if (!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID")
    }

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }

    const likedComment = await Like.findOne({comment: commentId, likedBy: userId})

    if (likedComment) {
        await likedComment.deleteOne()

        const likeCount = await Like.countDocuments({comment: commentId});

        return res.status(200).json(new ApiResponse(200, { liked: false, likeCount }, "Comment disliked successfully"))
    }

    await Like.create({ comment: commentId, likedBy: userId });

    const likeCount = await Like.countDocuments({comment: commentId});

    return res.status(201)
    .json(new ApiResponse(200, {liked: true, likeCount}, "Comment liked successfully"))
})


const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet

    const userId = req.user?._id

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const isLike = await Like.findOne({tweet: tweetId, likedBy: userId})
   
    if (isLike) {
        await isLike.deleteOne();

        const likeCount = await Like.countDocuments({tweet: tweetId});

        return res.status(200).json(new ApiResponse(200, { liked: false, likeCount }, "Tweet disliked successfully"));
    }

    const newLike = await Like.create({tweet: tweetId, likedBy: userId})

    const likeCount = await Like.countDocuments({tweet: tweetId})
    
    return res.status(201)
    .json(new ApiResponse(201, {liked: true, likeCount}, "Tweet liked successfully"))
})


const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos

    const {limit = 10, page = 1, query = "", sortType = "newest"} = req.query;

    const userId = req.user?._id

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }
    
    
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $ne: null }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
            }
        },
        {
            $unwind: "$video"
        },
        {
            $lookup: {
                from: "users",
                localField: "video.owner",
                foreignField: "_id",
                as: "channel",
            }
        },
        {
            $unwind: "$channel"
        },
        {
            $lookup: {
                from: "likes",
                localField: "video._id",
                foreignField: "video",
                as: "videoLikes",
            }
        },
        {
            $addFields: {
                likeCount: {$size: "$videoLikes"}
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
        {
            $project: {
                _id: "$video._id",
                title: "$video.title",
                description: "$video.description",
                thumbnail: "$video.thumbnail.url",
                views: "$video.views",
                likeCount: 1,
                likedAt: "$createdAt",
                channel: {
                    _id: "$channel._id",
                    avatar: "$channel.avatar",
                    username: "$channel.username"
                }
            }
        },
    ])

    const totalVideoLiked = await Like.countDocuments({likedBy: new mongoose.Types.ObjectId(userId)})

    return res.status(200)
    .json(new ApiResponse(200, {
        videos: likedVideos,
        total: totalVideoLiked,
        page: parseInt(page),
        limit: parseInt(limit)
    }, "All liked video by user fetched successfully"))
})


const getLikedComments =  asyncHandler(async (req, res) => {
    //TODO: get all liked comments

    const {limit = 10, page = 1, sortType = "newest"} = req.query;

    const userId = req.user?._id;

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortStage = sortType === "oldest" ? { "comments.createdAt": 1 } : { "comments.createdAt": -1 };
    
    const liked = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                comment: {$ne: null}
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "comment",
                foreignField: "_id",
                as: "comments",
            }
        },
        {
            $unwind: "$comments"
        },
        {
            $lookup: {
                from: "users",
                localField: "comment.owner",
                foreignField: "_id",
                as: "commentOwner"
            }
        },
        {
            $addFields: {
               commentOwner: {$first: "$commentOwner"}
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "comments._id",
                foreignField: "comment",
                as: "commentLikes"
            }
        },
        {
            $addFields: {
                likeCount: { $size: "$commentLikes"}
            }
        },
        { $sort: sortStage},
        { $skip: skip},
        { $limit: parseInt(limit)},
        {
            $project: {
                _id: 1,
                comment: {
                    _id: "$comments._id",
                    content: "$comments.content",
                    createdAt: "$comments.createdAt",
                    updatedAt: "$comments.updatedAt",
                    likeCount: "$likeCount",
                    owner: {
                        _id: "$commentOwner._id",
                        username: "$commentOwner.username",
                        avatar: "$commentOwner.avatar"
                    }
                }
            }
        }
    ])

    const total = await Like.countDocuments({likedBy: userId, comment: {$ne: null}})

    return res.status(200)
    .json(new ApiResponse(200, {
        likedComments: liked,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
    }, "All liked video by user fetched successfully"))
})


const getLikedTweets =  asyncHandler(async (req, res) => {
    //TODO: get all liked tweets

    const {limit = 10, page = 1, sortType = "newest"} = req.query;

    const userId = req.user?._id;

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortStage = sortType === "oldest" ? { "comments.createdAt": 1 } : { "comments.createdAt": -1 };
    
    const liked = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                tweet: {$ne: null}
            }
        },
        {
            $lookup: {
                from: "tweets",
                localField: "tweet",
                foreignField: "_id",
                as: "tweet"
            }
        },
        {
            $unwind: "$tweet"
        },
        {
            $lookup: {
                from: "users",
                localField: "tweet.owner",
                foreignField: "_id",
                as: "tweetOwner",
            }
        },
        {
            $addFields: {
                tweetOwner: { $first: "$tweetOwner" }
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "tweet._id",
                foreignField: "tweet",
                as: "tweetLikes"
            }
        },
        {
            $addFields: {
                likeCount: {$size: "$tweetLikes"}
            }
        },
        { $sort: sortStage},
        { $skip: skip},
        { $limit: parseInt(limit)},
        {
            $project: {
                _id: 1,
                tweet: {
                    _id: "$tweet._id",
                    content: "$tweet.content",
                    createdAt: "$tweet.createdAt",
                    updatedAt: "$tweet.updatedAt",
                    likeCount: "$likeCount",
                    owner: {
                        _id: "$tweetOwner._id",
                        username: "$tweetOwner.username",
                        avatar: "$tweetOwner.avatar"
                    }
                }
            }
        },
    ])

    const total = await Like.countDocuments({ likedBy: userId, tweet: { $ne: null } });


    return res.status(200)
    .json(new ApiResponse(200, {
            likedTweets: liked,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, "All liked tweet by user fetched successfully"))
})


export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos,
    getLikedComments,
    getLikedTweets
}