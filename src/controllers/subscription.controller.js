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

    if (userId.toString() === channelId) {
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
    
    return res.status(200).json(new ApiResponse(200, {subscription: newSubscription, subscribed: true}, "Channel subscribed successfully"))
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
        { $skip: (parseInt(page) - 1) * parseInt(limit)},
        { $limit: parseInt(limit)}
    ])

    const totalSubscribers = await Subscription.countDocuments({ channel: channelId })

    return res.status(200)
    .json(new ApiResponse(200, {subscribers: allSubscribers, totalSubscribers}, "Subscribers of a Channel fetched successfully"));
})


// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = req.query;

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
                "channel.password": 0,
                "channel.refreshToken": 0
            }
        },
        { $sort : {[sortBy]: parseInt(sortOrder)} },
        { $skip: (parseInt(page) - 1) * parseInt(limit)},
        { $limit: parseInt(limit)}
    ])

    const total = await Subscription.countDocuments({ subscriber: subscriberId})
    return res.status(200)
    .json(new ApiResponse(200, {subscription: subscribedChannels, total}, "All Subscribed Channels by user fetched successfully"));
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
 
// output: getUserChannelSubscribers
// {
//     "statusCode": 200,
//     "message": "Subscribers of a Channel fetched successfully",
//     "data": {
//         "subscribers": [
//             {
//                 "_id": "68bad170c68ad94e4020c3fe",
//                 "subscriber": {
//                     "_id": "682659b27780ef0a132de1b2",
//                     "username": "chaiaurcode",
//                     "email": "h@hc.com",
//                     "fullName": "chai aur code",
//                     "avatar": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1747343810/n9y93wcvlwpolyzb1fmr.png",
//                     "coverImage": "",
//                     "watchHistory": [],
//                     "password": "$2b$10$QhJgeWm4hmpZ3DuyYY86RuHsFb4EslwDJxx/WjHhTB/ASa2RpUf/i",
//                     "createdAt": "2025-05-15T21:16:34.494Z",
//                     "updatedAt": "2025-09-05T12:02:40.700Z",
//                     "__v": 0,
//                     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODI2NTliMjc3ODBlZjBhMTMyZGUxYjIiLCJpYXQiOjE3NTcwNzM3NjAsImV4cCI6MTc1NzkzNzc2MH0.15pm1Ke_iNBlFq3IoDajHzILd3L_KhpJtmE0gjmYrUc"
//                 },
//                 "channel": "6826f66c4fe0436991c7e6a7",
//                 "createdAt": "2025-09-05T12:02:56.401Z",
//                 "updatedAt": "2025-09-05T12:02:56.401Z",
//                 "__v": 0
//             }
//         ],
//         "total": 1
//     },
//     "success": true
// }


//   output of toggleSubscription
// {
//     "statusCode": 200,
//     "message": "Channel unsubscribed successfully",
//     "data": false,
//     "success": true
// }
//    OR TOGGLE
// {
//     "statusCode": 200,
//     "message": "Channel subscribed successfully",
//     "data": {
//         "subscription": {
//             "subscriber": "682659b27780ef0a132de1b2",
//             "channel": "6826f66c4fe0436991c7e6a7",
//             "_id": "68dd70e891aa1e8d87413ca5",
//             "createdAt": "2025-10-01T18:20:24.032Z",
//             "updatedAt": "2025-10-01T18:20:24.032Z",
//             "__v": 0
//         },
//         "subscribed": true
//     },
//     "success": true
// }


// output of getSubscribedChannels
// {
//     "statusCode": 200,
//     "message": "All Subscribed Channels by user fetched successfully",
//     "data": {
//         "subscription": [
//             {
//                 "_id": "68e2ce702326020cb3aee04b",
//                 "subscriber": "682659b27780ef0a132de1b2",
//                 "channel": {
//                     "_id": "6826f66c4fe0436991c7e6a7",
//                     "username": "one",
//                     "email": "hello@gmail.com",
//                     "fullName": "hello",
//                     "avatar": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1750875333/videotube/pz96qxm97nwxeqbp5znk.png",
//                     "coverImage": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1758395626/videotube/ffewr4ijcy7phid6d2yy.png",
//                     "watchHistory": [],
//                     "createdAt": "2025-05-16T08:25:16.205Z",
//                     "updatedAt": "2025-10-05T19:36:01.223Z",
//                     "__v": 0
//                 },
//                 "createdAt": "2025-10-05T20:00:48.029Z",
//                 "updatedAt": "2025-10-05T20:00:48.029Z",
//                 "__v": 0
//             }
//         ],
//         "total": 1
//     },
//     "success": true
// }