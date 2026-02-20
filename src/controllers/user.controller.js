import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { deleteOnCloudinary, thumbnailUploaded, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
// import { Subscription } from "../models/subscription.model.js";
import { getPublicIdFromUrl } from "../utils/deleteCloudinaryFile.js";
import { cloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
// import redisClient from "../config/redis.js";



const generateAccessAndRefreshTokens = async(userId) => {
    try {
        // here by User is object of mongoose it uses findById() which used to find user
        // user is instant of User Model by this instance we can used function defined by we(user-define function like generateAccessToken) in User Model file
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()   
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken       // Here we store refreshToken in Database
        await user.save({ validateBeforeSave: false })  // Here user is save by .save()

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Refresh and Access Token")
    }
}


const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for email, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token filed from response
    // check for user creation
    // return response

    const {fullName, email, username, password} = req.body;
    
    // Here we check that fileds are empty then show Error
    if (
        [fullName, email, username, password].some((filed) =>
        filed?.trim() === "")
    ) {
        throw new ApiError(400, "All filed are required")
    }

    // Here we find user by username or email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }


    // like "express" give 'req.body' access same "multer" give 'req.files' 
    // Here we get path of file store by multer in local storage 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {   // Here we check for coverImage is not-undefined then assign path to coverImageLocalPath Because here we doesn't want to give Error
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // Here we pass local file path to upload files on Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is require")
    }

    // Here we create entry of user in DataBase
    const user = await User.create({
        fullName,
        avatar: {
            url: avatar.url,
            public_id: avatar.public_id
        },
        coverImage: {
            public_id: coverImage?.public_id || "",
            url: coverImage?.secure_url || ""
        },
        email,
        password,
        username: username.toLowerCase(),
    })

    // Here we find user by _id this filed is mongoose assign with each entry of user 
    // Here select() we pass filed which we doesn't want in response & findById() is used to find user by id
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
} )


const loginUser = asyncHandler( async (req, res) => {
    // req body se data lenge
    // username or email ko user se lenge taki user ko find kar paye
    // find the user
    // password check karenge
    // accessToken and refershToken ko generate karenge aur refreshToken ko Database me store karenge aur user ko bhi denge
    // send cookie here we send to

    const {email, username, password} = req.body

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    // Here are alternate code based on logic discuss
    // if ((username || email)) {
    //     throw new ApiError(400, "username or email is required")
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // Here we pass password function that we create .isPasswordCorrect(password) this check password is correct & return true or false
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // here we pass user id to generate Token & extract from generateAccessAndRefreshTokens()
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
    // here we create options which is used to safe the cookie data like refreshToken 
    // we write options in object & by this we can't edit cookie data we can only edit from server
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options) // Here we can used cookie because we used "cookieParser" as Middelware in app.js file
    .cookie("refreshToken", refreshToken, options) // In cookie() we pass key, value & options
    .json(  // Here we give json response because if user want to save refreshToken, accessToken or want use mobile app
        new ApiResponse(
            200, 
            {
                user: loggedInUser //accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

} )

const logoutUser = asyncHandler( async (req, res) => {
    // set refreshToken to undefined in DataBase
    // clear the refresh and accessToken from cookie
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refershToken: 1  // This $unset operator is use to remove the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {
        // Here req.cookies.refreshToken is used to access token from cookie & req.body.refreshToken is used for access token if user use mobile app 
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request: No refresh token provided");
    }

    try {
        // Here jwt.verify() take 2 parameter as Token and Secret_of_token & give decoded information or token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }
    
        // If refreshToken stored in cookie of user & the refreshToken store in DataBase is not match then this show Error message 
        // otherwise generate new Access & RefreshToken then give it to user in cookie & store in DataBase by login in auth.middleware
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used")
        }

        // Optional: log comparison
        // console.log("Incoming:", incomingRefreshToken);
        // console.log("Stored:", user.refreshToken);
    
        // Here we generate Access And RefreshTokens
        const {accessToken, newRefreshToken} = generateAccessAndRefreshTokens(user._id)

        // Store the new refresh token in DB
        user.refreshToken = newRefreshToken;
        user.save({ validateBeforeSave: false });


        const options = {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        }
    
        // Here we store Token in cookies
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        console.error("Refresh token error:", error);
        throw new ApiError(error?.message || "Invalid refresh Token")
    }
} )

const changeCurrentUserPassword = asyncHandler( async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })


    return res.status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ApiError(200, "User not Found")
    }

    const currUser = req.user;

    // const user = redisClient.get("user");

    // if (!user) {
    //     await redisClient.set("user", JSON.stringify(currUser));
    // }

    return res.status(200)
    .json(new ApiResponse(200, currUser, "Current user fetchedd successfully"))
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email, username} = req.body
    
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const userId = req.user?._id;

    // const storeUser = await redisClient.get(`user:${userId}`);

    // if (storeUser) {
    //     return res.status(200)
    //     .json(new ApiResponse(200, storeUser, "Account details updated successfully"))
    // }
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
                username
            }
        },
        { new: true }
    ).select("-password")

    // await redisClient.set(`user:${user._id}`, JSON.stringify(user));
    
    return res.status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})


const updateUserAvatar = asyncHandler( async (req, res) => {
    
    const avatarLocalPath = req.file?.path
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    // 1. Get the current user from DB
    const user = await User.findById(req.user?._id)

    // 2. If user has an existing avatar, delete it from Cloudinary
    if (user?.avatar) {
        await deleteOnCloudinary(user.avatar.public_id)
    }

    // 3. Upload new avatar to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar image")
    }

     
    // 4. Update user's avatar in DB
    const updatedAvatarImage = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: {
                avatar: {
                    url: avatar.url,
                    public_id: avatar.public_id
                }
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, updatedAvatarImage, "Avatar image updated successfully")
    )
})


const updateUserCoverIMage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }
      // 1. Get the current user from DB
    const user = await User.findById(req.user?._id)

    // 2. If user has an existing coverImage, delete it from Cloudinary
    if (user?.coverImage) {
        await deleteOnCloudinary(user.coverImage.public_id)
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
    }

    const updatedCoverImage = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: {
                coverImage: {
                    url: coverImage.url,
                    public_id: coverImage.public_id
                }
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, updatedCoverImage, "Cover image updated successfully"))
})


const getUserChannelProfile = asyncHandler( async (req, res) => {
    const {username} = req.params   // we take username from url parameters

    if (!username) {
        throw new ApiError(400, "username is missing")
    }

    const userId = req.user?._id || null;

    // const storeChannel = await redisClient.get(`user:${userId}`);
    // console.log("storeChannel type:", typeof storeChannel, storeChannel);

    // if (storeChannel) {
    //     const parse = JSON.parse(storeChannel);
    //     console.log("storeChannel:", parse);
    //      return res.status(200)
    //     .json(new ApiResponse(200, parse, "User channel fetched successfully"));
    // }

    // here we write Aggregate Pipeline which user to get join "Subscription" Model with "User" Model here wee write pipelines in objects
    // in 1st pipeline we match username then next pipeline match _id filed with channel field if same then store result in subscribers
    // In 4th pipeline we add new filed in user model by "$addFields " & pass feild_name: value  In 5th pipeline $project Feild is used to present specific feilds only
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "channel",
                            foreignField: "_id",
                            as: "channel",
                        }
                    },
                    { $unwind: "$channel" },
                    {
                        $project: {
                            _id: 0,
                            "channel._id": 1,
                            "channel.avatar": 1,
                            "channel.coverImage": 1,
                            "channel.username": 1,
                            "channel.fullName": 1,
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $and: [
                             {$ne: [userId, null]},
                             {$in: [userId, "$subscribers.subscriber"]} 
                            ]},  // here $in is used to check condition that req.user is present in subscribers field find the subscriber
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                password: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                subscribedTo: "$subscribedTo.channel",
                subscribers: 1
            }
        }
    ])

    
    
    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }
    // await redisClient.set(`channel:${channel._id}`, JSON.stringify(channel[0]));
    
    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})


const getWatchHistory = asyncHandler( async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const history = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $unwind: "$watchHistory"  // break each {video, watchedAt} into separate docs
        },
        {
            // $lookup used to get data form another model or join another model to our model so we can get data
            $lookup: {
                from: "videos",  // this field take collection or model_name as value which we want to join
                localField: "watchHistory.video",  // This take localfield name which _id is match with foreignfield _id
                foreignField: "_id",        
                as: "video",     // This take filed name of our model in which another model data is to be store or we want to get
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
                as: "channel"
            }
        },
        {
            $unwind: "$channel"
        },
        {
            $sort: {"watchHistory.watchedAt": -1}
        },
        {
            $limit: limit
        },
        {
            $skip: skip
        },
        {
            $project: {
                _id: "$video._id",
                title: "$video.title",
                description: "$video.description",
                thumbnail: "$video.thumbnail.url",
                views: "$video.views",
                duration: "$video.duration",

                channelId: "$channel._id",
                channelName: "$channel.fullName",
                channelAvatar: "$channel.avatar",
                
                watchedAt: "$watchHistory.watchedAt",
                progress: "$watchHistory.progress",
            }
        }
    ])

    if (!history.length) {
        throw new ApiError(404, "history not found");
        // return res.status(200).json(
        //     new ApiResponse(200, [], "No watch history found")
        // )
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            history,
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverIMage,
    getUserChannelProfile,
    getWatchHistory
}

//  output of getCurrentUser for path: http://localhost:8000/api/v1/user/current-user
// {
//   "statusCode": 200,
//   "message": "Current user fetchedd successfully",
//   "data": {
//     "_id": "6826f66c4fe0436991c7e6a7",
//     "username": "one",
//     "email": "hello@gmail.com",
//     "fullName": "hello",
//     "avatar": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1750875333/videotube/pz96qxm97nwxeqbp5znk.png",
//     "coverImage": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1758395626/videotube/ffewr4ijcy7phid6d2yy.png",
//     "watchHistory": [],
//     "createdAt": "2025-05-16T08:25:16.205Z",
//     "updatedAt": "2025-10-03T16:58:15.660Z",
//     "__v": 0
//   },
//   "success": true
// }

// output of getUserChannelProfile for path: http://localhost:8000/api/v1/user/c/one 
// {
//   "statusCode": 200,
//   "message": "User channel fetched successfully",
//   "data": {
//     "_id": "6826f66c4fe0436991c7e6a7",
//     "username": "one",
//     "email": "hello@gmail.com",
//     "fullName": "hello",
//     "avatar": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1750875333/videotube/pz96qxm97nwxeqbp5znk.png",
//     "coverImage": "http://res.cloudinary.com/dqynbwfx7/image/upload/v1758395626/videotube/ffewr4ijcy7phid6d2yy.png",
//     "subscribersCount": 1,
//     "channelsSubscribedToCount": 1,
//     "isSubscribed": false
//   },
//   "success": true
// }