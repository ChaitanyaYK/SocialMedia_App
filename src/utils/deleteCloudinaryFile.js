import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "./cloudinary.js";


function getPublicIdFromUrl(url) {
    // Example Cloudinary URL format:
    // https://res.cloudinary.com/your-cloud-name/image/upload/v1718000000/foldername/filename.jpg
    try {
        const parts = url.split('/');
        const folderAndFilename = parts.slice(parts.indexOf('upload') + 1).join('/'); // Get path after /upload/

        const lastDotIndex = folderAndFilename.lastIndexOf(".");
        if (lastDotIndex === -1) return folderAndFilename;
        const publicId = folderAndFilename.substring(0, lastDotIndex); // remove extension
                        // Or Code for above 3 lines
        // const publicId = folderAndFilename.split('.')[0]; // Remove file extension

        return publicId;
    } catch (err) {
        console.error("Error while extracting public ID from URL:", err);
        return null;
    }
}


export {getPublicIdFromUrl}