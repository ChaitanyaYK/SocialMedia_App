import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema({
    video: {
        type: Schema.Types.ObjectId,
        ref: "Video",
        default: null
    },
    content: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 800
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: "Comment",
        default: null
    },
},
{
    timestamps: true
})

commentSchema.plugin(mongooseAggregatePaginate);
commentSchema.index({video: 1, createdAt: -1});
commentSchema.index({ parentComment: 1 })

export const Comment = mongoose.model("Comment", commentSchema)