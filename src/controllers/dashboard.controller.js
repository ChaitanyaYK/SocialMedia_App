import mongoose, {isValidObjectId} from "mongoose";
import {Video} from "../models/video.model.js";
import {Subscription} from "../models/subscription.model.js";
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

    const {channelId} = req.params;

    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId),
                // title: {$regex: query, $options: "i"}
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "channel",
                as: "channel",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "subscriber",
                            foreignField: "_id",
                            as: "subscriber"
                        }
                    },
                    {
                        $addFields: {
                            subscriberCount: {$size: "$subscriber"}
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $group: {
                _id: null,
                likeCount: {$sum:{$size: "$likes"}},
                totalViews: { $sum: "$views" }
            }
        },
        {
            $addFields: {
                videoCount: { $sum: 1 }
            }
        },
        {
            $project: {
                videoCount: 1,
                totalViews: 1,
                totalSubscriber: {
                    subscriberCount: 1,
                },
                likeCount: 1
            }
        }
    ])

    const totalSubscriber = await Subscription.countDocuments({channel: new mongoose.Types.ObjectId(channelId)})

    return res.status(200)
    .json(new ApiResponse(200, videoStats[0], "Channel stats Fetched successfully"))
})


const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel

    const {channelId} = req.params;
    const {page = 1, limit = 10, query = search,sortBy = "newest", isPublished} = req.query;

    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const sortStage = (() => {
        if (sortBy === "oldest") return {createdAt: 1};
        if (sortBy === "top") return {views: 1};
        return {createdAt: -1};
    })();

    const filter = {
        owner: new mongoose.Types.ObjectId(channelId),
        title: {$regex: query, $options: "i"}
    }

    const channelVideos = await Video.aggregate([
        {
            $match: filter
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "owner",
                as: "channelInfo"
            }
        },
        
        {
            $unwind: "$channelInfo"
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likeCount: {$size: "$likes"}
            }
        },
        { $sort: sortStage },
        { $skip: (parseInt(page)-1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
            $project: {
                _id: 1,
                title: 1,
                description: 1,
                views: 1,
                likeCount: 1,
                isPublished: 1,
                createdAt: 1,
                channel: {
                    _id: "$channelInfo._id",
                    username: "$channelInfo.username",
                    avatar: "$channelInfo.avatar"
                }
            }
        }
    ]);

    const totalCount = await Video.countDocuments(filter);

    return res.status(200)
    .json( new ApiResponse(200, {channelVideos,
        pagination: {
            total: totalCount,
            page: parsedInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        }}, "Channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }