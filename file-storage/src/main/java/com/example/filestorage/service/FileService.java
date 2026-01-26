package com.example.filestorage.service;

import com.example.filestorage.model.File;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface FileService {
    String uploadImageToFileSystem(MultipartFile file);
    List<String> uploadMultipleImagesToFileSystem(List<MultipartFile> files);
    Resource downloadImageFromFileSystem(String id);
    void deleteImageFromFileSystem(String id);
    File findFileById(String id);
}
