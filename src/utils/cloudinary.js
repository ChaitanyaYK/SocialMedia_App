import { v2 as cloudinary } from "cloudinary";
import fs from "fs";


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const fileType = localFilePath.endsWith(".mp4") ? "video" : "auto";

        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: fileType,
            folder: "videotube/videos",
            streaming_profile: "hd", // auto-generate multiple qulities
            eager_async: false,
            // type: "upload"
        });

        // file has been uploaded successfully

        if(fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath); // remove the locally saved temporary file 
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload opertion got failed
        console.error("Cloudinary Upload Error:", error);
        return null;
    }
}

const thumbnailUploaded = async (thumbnailLocalPath) => {
    try {
        if(thumbnailLocalPath) return null;

        const response = await cloudinary.uploader.upload(thumbnailLocalPath, {
            resource_type: "image",
            folder: "videotube/thumbnails",
            transformation: [
                {
                    aspect_ratio: "16:9",
                    crop: "fill",
                    gravity: "auto"
                }
            ]
        })

        if(fs.existsSync(thumbnailLocalPath)) fs.unlinkSync(thumbnailLocalPath);
        return response;
    } catch (error) {
        fs.unlinkSync(thumbnailLocalPath);
        console.log("Cloudinary Upload Error: ", error);
        return null;
    }
}

const deleteOnCloudinary = async (public_id, resource_type="image") => {
    try {
        if (!public_id) return null;

        const response = await cloudinary.uploader.destroy(public_id, { resource_type: `${resource_type}`});
    } catch (error) {
        console.log("delete on cloudinary failed", error);
        return error
    }
}

export { uploadOnCloudinary, cloudinary, deleteOnCloudinary, thumbnailUploaded };