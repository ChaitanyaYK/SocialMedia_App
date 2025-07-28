import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params;
    // TODO: toggle subscription

    // get userId 
    // check channel & user Id isValidate or not
    // condition if subscribed then delete() otherwise create subscription
    // return response of toggle Subscription
    const userId = req.user?.id;
    
    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel Id");
    }

    if (req.user._id.toString() === channelId) {
        throw new ApiError(400, "You cannot subscribe to yourself");
    }

    const existSubscription = await Subscription.findOne({
        subscriber: userId, 
        channel: channelId
    })
    
    let subscribed;
    if (existSubscription) {
        await Subscription.deleteOne({ _id: existSubscription._id})
        subscribed = false;
        return res.status(200).json(new ApiResponse(200, subscribed, "Channel unsubscribed successfully"))
    }

    const newSubscription = await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId
    })
    subscribed = true;
    
    return res.status(200).json(new ApiResponse(200, newSubscription[0], subscribed, "Channel subscribed successfully"))
})


// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const { page = 1, limit = 10, sortBy = {createdAt: -1}} = req.query
    // validate channelId
    // find all document of subscribers which contain channelId by channelId
    // return response

    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel Id");
    }

    const allSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber"
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0
            }
        },
        {
            $addFields: { subscriber: { $first: "$subscriber" } }
        },
        { $sort : sortBy },
        { $page: page},
        { $skip: (parseInt(page) - 1) * parseInt(limit)},
        { $limit: parseInt(limit)}
    ])

    const countSubscribers = await Subscription.countDocuments({ channel: channelId })

    return res.status(200)
    .json(200, allSubscribers[0], countSubscribers, "Subscribers of a Channel fetched successfully")
})


// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    const { page = 1, limit = 10, sortBy = {createdAt: -1}} = req.query;

    if (!subscriberId || !isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber Id");
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel"
            }
        },
        {
            $addFields: { channel: { $first: "$channel" } }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0
            }
        },
        { $sort : sortBy },
        { $page: page},
        { $skip: (parseInt(page) - 1) * parseInt(limit)},
        { $limit: parseInt(limit)}
    ])

    const countChannels = await subscribedChannels.countDocuments({ subscriber: subscriberId})
    return res.status(200)
    .json(200, subscribedChannels[0], countChannels, "All Subscribed Channels by user fetched successfully")
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}