import mongoose, {Schema} from "mongoose";


const tweetSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    replies: [{
        type: Schema.Types.ObjectId,
        ref: "Tweet"  // by this we support threaded replies
    }]
},
{
    timestamps: true
})

tweetSchema.index({ content: "text"})

export const Tweet = mongoose.model("Tweet", tweetSchema)