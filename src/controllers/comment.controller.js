import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const getVideoComments = asyncHandler(async (req, res) => {
    const {page = 1, limit = 10, query = "", sortBy = "newest"} = req.query;
    //TODO: get all comments for a video
    const {videoId} = req.params;
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // const comments = await Comment.find(videoId)
    // .populate("owner", "username avatar")
    // .populate("replies")
    // .sort({createdAt: -1 })
    // .skip((page - 1) * limit)
    // .limit(parseInt(limit))

    let sortStage;
    if (sortBy === "oldest") {
        sortStage = { createdAt: 1 };
    } else if (sortBy === "top") {
        sortStage = { likeCount: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const commentAggregate = await Comment.aggregate([
        {
            $match: {
                $or: [
                    { content: { $regex: query, $options: "i"} },
                    { video: new mongoose.Types.ObjectId(videoId) }
                ]
            }
        },
        {   // $facet is used to return totalCount in same query
            $facet: {
                comments: [
                    {
                        $lookup: {
                           from: "users",
                           localField: "owner",
                           foreignField: "_id",
                           as: "owner",
                           pipeline: [
                                { $project: { username: 1, avatar: 1 } }
                           ]
                       }  
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    },
                    {
                        $lookup: {
                            from: "likes",
                            localField: "_id",
                            foreignField: "comment",
                            as: "likes"
                        }
                    },
                    {
                        $addFields: {
                            likeCount: { $size: "$likes" },
                            isLiked: {
                                $in: [req.user._id, "$likes.likedBy"]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "comments",
                            localField: "_id",
                            foreignField: "parentComment",
                            as: "replies",
                            pipeline: [
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "owner",
                                        foreignField: "_id",
                                        as: "owner",
                                        pipeline: [
                                            { $project: { username: 1, avatar: 1 } }
                                        ]
                                    }
                                },
                                {
                                    $addFields: {
                                        owner: { $first: "$owner" }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "likes",
                                        localField: "_id",
                                        foreignField: "comment",
                                        as: "likes"
                                    }
                                },
                                {
                                    $addFields: {
                                        likeCount: { $size: "$likes" },
                                        isLiked: {
                                            $in: [req.user._id, "$likes.likedBy"]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        content: 1,
                                        owner: 1,
                                        likeCount: 1,
                                        isLiked: 1,
                                        createdAt: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            replies: { $first: "$replies" }
                        }
                    },
                    {
                        $project: {
                            content: 1,
                            owner: 1,
                            likeCount: 1,
                            isLiked: 1,
                            replies: 1,
                            createdAt: 1
                        }
                    },
                    { $sort: sortStage || { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: parseInt(limit) }
                ],
                totalComments: [
                    { $count: "total"}
                ]
            }

        }
    ])

    const comments = commentAggregate[0].comments || [];
    const totalComments = commentAggregate[0].totalComments[0]?.total || 0;

    return res.status(200).json(new ApiResponse(200,{
        comments,
        pagination: {
            totalComments,
            page: +page,
            limit: +limit,
            totalPages: Math.ceil(totalComments / limit)
        }

        }, "All Comment on a video are fetched successfully"
    ))
})


const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video

    const {videoId} = req.params;
    const {content} = req.body;

    if (content.trim() === "" || !content) {
        throw new ApiError(400, "Comment content is required")
    }

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const newComment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id
    })
    
    if (!newComment) {
        throw new ApiError(500, "Something went wrong while creating the Comment");
    }
    
    const populatedComment = await Comment.findById(newComment._id)
        .populate("owner", "username avatar")

    return res.status(201)
    .json(new ApiResponse(200, populatedComment, "Comment added successfully"))
})


const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params
    const {content} = req.body

    if (!content) {
        throw new ApiError(400, "content is required")
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    const comment = await Comment.findById(commentId)
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this comment");
    }

    comment.content = content;
    await comment.save();

    const updatedComment = await Comment.findById(commentId)
        .populate("owner", "username avatar")

    return res.status(200)
    .json(new ApiResponse(200, updatedComment, "Comment Updated successfully"))
})


const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params
    
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this comment");
    }

    await comment.deleteOne();

    return res.status(200)
    .json(new ApiResponse(200, {}, "Comment Deleted successfully"))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}
