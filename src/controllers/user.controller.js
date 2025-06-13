import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        // here by User is object of mongoose it uses findById() which used to find user
        // user is instant of User Model by this instance we can used function defined by we(user-define function like generateAccessToken) in User Model file
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()   
        const refershToken = user.generateRefreshToken()

        user.refershToken = refershToken       // Here we store refreshToken in Database
        await user.save({ validateBeforeSave: false })  // Here user is save by .save()

        return {accessToken, refershToken}

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
    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createUser, "User registered Successfully")
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
    const {accessToken, refershToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
    // here we create options which is used to safe the cookie data like refreshToken 
    // we write options in object & by this we can't edit cookie data we can only edit from server
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options) // Here we can used cookie because we used "cookieParser" as Middelware in app.js file
    .cookie("refreshToken", refershToken, options) // In cookie() we pass key, value & options
    .json(  // Here we give json response because if user want to save refreshToken, accessToken or want use mobile app
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refershToken
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
            $set: {
                refershToken: undefined
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

    if (incomingRefreshToken) {
        throw new ApiError(401, "unathorized request")
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
    
        // Here we generate Access And RefreshTokens
        const {accessToken, newRefreshToken} = generateAccessAndRefreshTokens(user._id)
    
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
        throw new ApiError(error?.message || "Invalid refresh Token")
    }
} )

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}