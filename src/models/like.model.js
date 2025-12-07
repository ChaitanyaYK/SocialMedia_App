import mongoose, {Schema} from "mongoose";

const likeSchema = new Schema({
    video: {
        type: Schema.Types.ObjectId,
        ref: "Video"
    },
    comment: {
        type: Schema.Types.ObjectId,
        ref: "Comment"
    },
    tweet: {
        type: Schema.Types.ObjectId,
        ref: "Tweet"
    },
    likedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
},
{
    timestamps: true
})

likeSchema.index({comment: 1, createdAt: -1})
likeSchema.index({video: 1, createdAt: -1})
likeSchema.index({tweet: 1, createdAt: -1})
export const Like = mongoose.model("Like", likeSchema)