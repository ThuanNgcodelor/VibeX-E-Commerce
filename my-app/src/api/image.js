import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);




/**
 * Upload nhiều ảnh cùng lúc
 * @param {File[]|FileList} files - Mảng các file ảnh cần upload
 * @returns {Promise<string[]>} - Promise trả về mảng các ID của các file đã upload thành công
 */
export const uploadMultipleImages = async (files) => {
    try {
        if (!files || files.length === 0) {
            throw new Error("No files provided");
        }

        const formData = new FormData();
        const filesArray = Array.from(files);

        filesArray.forEach((file) => {
            if (file instanceof File) {
                formData.append("images", file);
            }
        });

        const response = await api.post("/file-storage/upload-multiple", formData, {
            transformRequest: [(payload, headers) => {
                delete headers.common?.["Content-Type"];
                delete headers.post?.["Content-Type"];
                delete headers["Content-Type"];
                return payload;
            }],
        });

        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to upload images");
    }
};

/**
 * Upload một ảnh đơn lẻ
 * @param {File} file - File ảnh cần upload
 * @returns {Promise<string>} - Promise trả về ID của file đã upload thành công
 */
export const uploadImage = async (file) => {
    try {
        if (!file) {
            throw new Error("No file provided");
        }

        const formData = new FormData();
        formData.append("image", file);

        const response = await api.post("/file-storage/upload", formData, {
            transformRequest: [(payload, headers) => {
                delete headers.common?.["Content-Type"];
                delete headers.post?.["Content-Type"];
                delete headers["Content-Type"];
                return payload;
            }],
        });

        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to upload image");
    }
};



/**
 * Tạo URL string cho thẻ <img> (tránh hardcode localhost).
 * Khác với fetchImageById (trả về dữ liệu binary), hàm này trả về string URL.
 * @param {string} imageId - ID của ảnh
 * @returns {string} - Đường dẫn tương đối (e.g. /v1/file-storage/get/...)
 */
export const getImageUrl = (imageId) => {
    return imageId ? `${API_URL}/file-storage/get/${imageId}` : null;
};

/**
 * Upload video (Sử dụng chung endpoint với image do backend dùng chung logic FileSystem)
 * @param {File} file - File video cần upload
 * @returns {Promise<string>} - Promise trả về ID của file
 */
export const uploadVideo = async (file) => {
    try {
        if (!file) {
            throw new Error("No file provided");
        }

        const formData = new FormData();
        // Backend yêu cầu key là "image" ngay cả với video
        formData.append("image", file);

        const response = await api.post("/file-storage/upload", formData, {
            transformRequest: [(payload, headers) => {
                delete headers.common?.["Content-Type"];
                delete headers.post?.["Content-Type"];
                delete headers["Content-Type"];
                return payload;
            }],
        });

        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to upload video");
    }
};

/**
 * Lấy URL của video từ ID
 * @param {string} videoId 
 * @returns {string}
 */
export const getVideoUrl = (videoId) => {
    return videoId ? `${API_URL}/file-storage/download/${videoId}` : null;
};


