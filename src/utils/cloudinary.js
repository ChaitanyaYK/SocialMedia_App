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
            folder: "videotube"
        })
        // file has been uploaded successfully
        // console.log("file is uploaded on cloudinary",response.url);
        // if(fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
        fs.unlink(localFilePath, (err) => {
            if (err) console.warn("File delete failed:", err.message);
        });

        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload opertion got failed
        console.error("Cloudinary Upload Error:", error);
        return null;
    }
}

export { uploadOnCloudinary, cloudinary }