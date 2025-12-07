import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import { Video } from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description=null} = req.body;

    // TODO: create playlist

    // get userId and check if they validate or not
    // call to playlist model & create playlist 
    // check playlist created or not 
    // return response of created playlist
    const {userId} = req.user?._id;

    if (!userId || isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid video Id");
    }

    if (!name) {
        throw new ApiError(400, "Playlist Name is required")
    }
    
    const playlist = await Playlist.create({
        name,
        description,
        owner: userId,
    })

    const createdPlaylist = await Playlist.findById(playlist._id).select(
        "video"
    )

    return res.status(200)
    .json(new ApiResponse(200, createdPlaylist, "Playlist Created successfully"))
})


const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists

    const { search = "", page = 1, limit = 10 } = req.query;

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);


    const pipeline = [
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            description: 1,
                            duration: 1,
                            views: 1,
                            isPublished: 1,
                            thumbnail: 1,
                            videoFile: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                // video: { $first: "$video" },
                coverVideo: { $arrayElemAt: ["$videos", 0 ]},
                totalVideos: {
                    $size: "$videos"
                }
            }
        },
        { $skip: skip},
        { $limit: parseInt(limit) }
    ]

    const [playlists, total] = await Promise.all([
        Playlist.aggregate(pipeline),
        Playlist.aggregate([
            {
                 $match: {
                    owner: new mongoose.Types.ObjectId(userId),
                    $or: [
                        { name: { $regex: search, $options: "i" } },
                        { description: { $regex: search, $options: "i" } }
                    ]
                }
            },
            {
                $count: "total"
            }
        ])
    ])

    const totalPlaylists = total[0]?.total || 0;
    // if (playlists.toString() !== req.user?._id) {
    //     throw new ApiError(403, "you are not authorized to fetched playlist")
    // }

    return res.status(200).json(new ApiResponse(200, { 
            playlists, 
            totalPlaylists,
            page: parseInt(page),
            totalPages: Math.ceil(totalPlaylists / limit)
        }, "user playlist fetched succesfully")
    )
})


const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    // const playlist = await Playlist.findById(playlistId).populate("videos")
           // OR CODE 
    const [playlists] = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(playlistId),
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video"
            }
        },
        {
            $addFields: {
                // video: { $first: "$video" },
                countTotalVideo: {
                    $size: "$video"
                }
            }
        }
    ])

    if (!playlists) {
        throw new ApiError(404, "playlist not found")
    }
    
    if (playlists.owner.toString() !== req.user?._id) {
        throw new ApiError(403, "you are not authorized to fetched playlist")
    }

    return res.status(200).json(200, playlists, "playlist fetched succesfully")
})


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id");
    }
    
    const [playlist, videos] = await Promise.all([
        Playlist.findById(playlistId),
        Video.findById(videoId)
    ])
    
    if (!playlist) throw new ApiError(404, "playlist not found");
    if (!videos) throw new ApiError(404, "Video not found");

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to modify this playlist")
    }
    
    if (playlist.video.includes(videoId)) {
        throw new ApiError(400, "Video already exist in Playlist")
    }  
    
    playlist.video.push(videoId)
    await playlist.save({validatateBeforeSave: true})

    return res.status(200)
    .json(new ApiResponse(200, playlist, "Video added to playlist successfully"))
})


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "playlist not found");
    }

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "you are not authorized to delete playlist")
    }

    

    playlist.video = playlist.video.filter(
        (id) => id.toString() !== videoId
    )

    await Playlist.video.findByIdAndDelete(videoId)
    await playlist.save({validatateBeforeSave: false})

    return res.status(200)
    .json(new ApiResponse(200, playlist, "video is remove from playlist successfully"))
})


const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    
    const playlist = await Playlist.findById(playlistId)
    
    if (!playlist) {
        throw new ApiError(404, "playlist not found")
    }

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "you are not authorized to delete playlist")
    }

    await playlist.deleteOne();

    return res.status(200)
    .json(new ApiResponse(200, {}, "playlist deleted successfully"))
})


const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }
    if (!name || !description) {
        throw new ApiError(400, "name & description is required");
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true
        }
    )

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to update this playlist");
    }

    return res.status(200)
    .json(new ApiResponse(200, playlist, "playlist updated successfully"))
})


export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
