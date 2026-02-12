import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            public_id: {
                type: String,
                required: true
            },
            hls_url: {
                type: String,
                required: true
            },
            type: {
                type: String,
                enum: ["mp4", "hls"],
                default: "hls"
            }
        },
        thumbnail: {
            type: {
                public_id: String,
                url: String    // cloudinary url
            },
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: String,
            required: true,
            default: 0
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        
    },
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)
videoSchema.index({videoFile: 1})
videoSchema.index({thumbnail: 1})

export const Video = mongoose.model("Video", videoSchema, "videos")