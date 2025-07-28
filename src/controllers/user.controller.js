import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
// import { Subscription } from "../models/subscription.model.js";
import { getPublicIdFromUrl } from "../utils/deleteCloudinaryFile.js";
import { cloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";



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

    const {fullName, email, username, password} = req.body
    // console.log("email: ", email);

    // console.log(req.body);
    
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

    // console.log(req.files);
    

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
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
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
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options) // Here we can used cookie because we used "cookieParser" as Middelware in app.js file
    .cookie("refreshToken", refreshToken, options) // In cookie() we pass key, value & options
    .json(  // Here we give json response because if user want to save refreshToken, accessToken or want use mobile app
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
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
        secure: true
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
        console.log("Incoming:", incomingRefreshToken);
        console.log("Stored:", user.refreshToken);
    
        // Here we generate Access And RefreshTokens
        const {accessToken, newRefreshToken} = generateAccessAndRefreshTokens(user._id)

        // Store the new refresh token in DB
        user.refreshToken = newRefreshToken;
        user.save({ validateBeforeSave: false });


        const options = {
            httpOnly: true,
            secure: true
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
        console.error("❌ Refresh token error:", error);
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
    return res.status(200)
    .json(new ApiResponse(200, {}, "Current user fetchedd successfully"))
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body
    
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")
    
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
        const publicId = getPublicIdFromUrl(user.avatar)
        if (publicId) {
            await cloudinary.uploader.destroy(publicId)
        }
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
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, updatedAvatarImage, "Avatar image updated successdfully")
    )
})


const updateUserCoverIMage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
      // 1. Get the current user from DB
    const user = await User.findById(req.user?._id)

    // 2. If user has an existing coverImage, delete it from Cloudinary
    if (user?.coverImage) {
        const publicId = getPublicIdFromUrl(user.coverImage)
        if (publicId) {
            await cloudinary.uploader.destroy(publicId)
        }
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const updatedCoverImage = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: {
                coverImage: coverImage.url
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
                foreignField: "subsciber",
                as: "subscribedTo"
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
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},  // here $in is used to check condition that req.user is present in subscribers field find the subscriber
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
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ])

    // console.log(channel);

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }
    
    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})


const getWatchHistory = asyncHandler( async (req, res) => {
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            // $lookup used to get data form another model or join another model to our model so we can get data
            $lookup: {
                from: "videos",  // this field take collection or model_name as value which we want to join
                localField: "watchHistory",  // This take localfield name which _id is match with foreignfield _id
                foreignField: "_id",        
                as: "watchHistory",     // This take filed name of our model in which another model data is to be store or we want to get
                
                pipeline: [  // This is used to add pipeline in existing pipeline or we can say sub-pipeline
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        email: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // $addField is used to add new feild in existing model 
                        $addFields: {
                            owner: {
                                $first: "$owner"  // by $first we can pass object so at frontend developer can extract data simple as owner.field_name
                            }
                        }
                    }
                ]
            }
        }
    ])

    if (!user || user.length === 0) {
        throw new ApiError(404, "User not found or has no watch history");
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
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