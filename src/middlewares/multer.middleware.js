import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDir = "public/temp";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {recursive: true});
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb){
        const ext = path.extname(file.originalname || "");
        const name = path.basename(file.originalname || "file", ext);
        const uniName = `${name}-${Date.now()}${ext}`;
        cb(null, uniName);
    }
})

export const upload = multer({ storage: storage });