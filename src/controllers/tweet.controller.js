import mongoose, { isValidObjectId } from "mongoose";
import {Tweet} from "../models/tweet.model.js";
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";


const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content, parentTweetId } = req.body

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Tweet content is required");
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user._id
    })

    if (!tweet) {
        throw new ApiError(404, "Some thing went wrong when created tweet");
    }

    // If it's a reply, update parent tweet
    if(parentTweetId && isValidObjectId(parentTweetId)) {
        await Tweet.findByIdAndUpdate( parentTweetId, {
            $push: { replies: tweet._id }
        })
    }

    const populatedTweet = await Tweet.findById(tweet._id)
    .populate("owner", "username avatar")


    return res.status(201)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
})


const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const {userId} = req.params
    const {page = 1, limit = 10, query = ""} = req.query

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // const filter = {
    //     owner: userId,
    //     content: { $regex: query, $options: "i" }
    // }
    // const skip = (page - 1) * limit;
    // const tweet = await Tweet.find(tweetId)
    //     .populate("owner", "username avatar")
    //     .populate("replies")
    //     .sort({createdAt: -1 })
    //     .skip(skip)
    //     .limit(parseInt(limit))

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
                ...(query && { $text: { $search: query } })
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { $project: { username: 1, avatar: 1}}
                ]
            }
        },        
        {
            $addFields: {
                owner: { $first: "$owner"}
            }
        },
        {
            $lookup: {
                from: "tweets",
                localField: "_id",
                foreignField: "replies",
                as: "replies",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                { $project: { username: 1 } }
                            ]
                        }
                    }
                ]
            },          
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes"
            }
        },
        {
            $addFields: {
                likeCount: { $size: { $ifNull: ["$likes", []] }},
                isLiked: {
                    $in: [req.user._id, { $ifNull: ["$likes.likedBy", []] }]
                },
                replyCount: {$size: { $ifNull: ["$replies", []] }}
            }
        },
        { $sort: {createdAt: -1} },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
            $project: {
                content: 1,
                createdAt: 1,
                author: 1,
                likeCount: 1,
                replyCount: 1,
                isLiked: 1
            }
        }
    ])

    const totalUserTweet = await Tweet.countDocuments({
        owner: userId,
        content: {$regex: query, $options: "i"}
    })

    return res.status(200)
    .json(new ApiResponse(200,{ 
        tweets,
        pagination: {
            totalUserTweet,
            totalPages: Math.ceil(totalUserTweet / limit),
            page: +page,
            limit: +limit
        },
    },  "All User Tweet fetched successfully"));
})


const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(tweetId) || !tweetId) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this tweet")
    }

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Updated tweet content is required");
    }

    tweet.content = content;
    await tweet.save();

    const updatedTweet = await Tweet.findById(tweetId)
    .populate("owner", "username avatar")

    return res.status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet Updated successfully"));
})


const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId) || !tweetId) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId)
    
    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }
    
    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet");
    }

    await Tweet.findByIdAndDelete(tweetId);

    return res.status(200)
    .json(new ApiResponse(200, {}, "Tweet Deleted successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}