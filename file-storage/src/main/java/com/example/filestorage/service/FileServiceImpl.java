package com.example.filestorage.service;

import com.example.filestorage.exception.GenericErrorResponse;
import com.example.filestorage.model.File;
import com.example.filestorage.repository.FileRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

@RequiredArgsConstructor
@Service
public class FileServiceImpl implements FileService {

    private final FileRepository fileRepository;

    @org.springframework.beans.factory.annotation.Value("${file.upload-dir:files}")
    private String FOLDER_PATH;

    @Override
    public String uploadImageToFileSystem(MultipartFile file) {
        String uuid = UUID.randomUUID().toString();
        // Ensure path uses forward slashes or correct separator
        String filePath = FOLDER_PATH + java.io.File.separator + uuid;
        try {
            file.transferTo(new java.io.File(filePath));
        } catch (IOException e) {
            e.printStackTrace();
            throw GenericErrorResponse.builder()
                    .message("Unable to save file to storage: " + e.getMessage())
                    .httpStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }

        fileRepository.save(File.builder()
                .id(uuid)
                .type(file.getContentType())
                .filePath(filePath).build());
        return uuid;
    }

    @Override
    public List<String> uploadMultipleImagesToFileSystem(List<MultipartFile> files) {
        List<String> uploadedIds = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                String uuid = uploadImageToFileSystem(file);
                uploadedIds.add(uuid);
            }
        }

        return uploadedIds;
    }

    @Override
    public Resource downloadImageFromFileSystem(String id) {
        // Construct path dynamically to avoid issues with absolute paths stored in DB
        // from different environments
        String filePath = FOLDER_PATH + java.io.File.separator + id;
        java.io.File file = new java.io.File(filePath);
        if (!file.exists()) {
            throw GenericErrorResponse.builder()
                    .message("File not found in storage: " + id)
                    .httpStatus(HttpStatus.NOT_FOUND)
                    .build();
        }
        return new FileSystemResource(file);
    }

    @Override
    public void deleteImageFromFileSystem(String id) {
        // Construct path dynamically
        String filePath = FOLDER_PATH + java.io.File.separator + id;
        java.io.File file = new java.io.File(filePath);

        // Also remove from DB
        fileRepository.deleteById(id);

        if (file.exists()) {
            boolean deleted = file.delete();
            if (!deleted) {
                // Log warning but don't throw if DB is consistent
                System.err.println("Warning: Failed to delete physical file: " + filePath);
            }
        }
    }

    @Override
    public File findFileById(String id) {
        return fileRepository.findById(id)
                .orElseThrow(() -> GenericErrorResponse.builder()
                        .message("Unable to find file")
                        .httpStatus(HttpStatus.NOT_FOUND).build());
    }

    @PostConstruct
    public void init() {
        java.io.File targetFolder = new java.io.File(FOLDER_PATH);

        if (!targetFolder.exists()) {
            boolean directoryCreated = targetFolder.mkdirs();
            if (!directoryCreated) {
                throw GenericErrorResponse.builder()
                        .message("unable to create directories: " + FOLDER_PATH)
                        .httpStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                        .build();
            }
        }
    }
}
