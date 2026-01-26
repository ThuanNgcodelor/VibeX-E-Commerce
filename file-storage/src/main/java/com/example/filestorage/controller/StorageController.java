package com.example.filestorage.controller;

import com.example.filestorage.model.File;
import com.example.filestorage.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/v1/file-storage")
@RequiredArgsConstructor
public class StorageController {
    private final FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<String> uploadImageToFIleSystem(@RequestPart("image") MultipartFile file) {
        return ResponseEntity.ok()
                .body(fileService.uploadImageToFileSystem(file));
    }

    @PostMapping("/upload-multiple")
    public ResponseEntity<List<String>> uploadMultipleImagesToFileSystem(
            @RequestPart("images") MultipartFile[] files) {
        List<String> uploadedIds = fileService.uploadMultipleImagesToFileSystem(List.of(files));
        return ResponseEntity.ok().body(uploadedIds);
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<Resource> downloadImageFromFileSystem(@PathVariable String id) {
        Resource resource = fileService.downloadImageFromFileSystem(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/octet-stream"))
                .body(resource);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> deleteImageFromFileSystem(@PathVariable String id) {
        fileService.deleteImageFromFileSystem(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/get/{id}")
    ResponseEntity<Resource> getImageById(@PathVariable String id) {
        File file = fileService.findFileById(id);
        Resource resource = fileService.downloadImageFromFileSystem(id);
        // Default to octet-stream if type is missing, but usually type is present
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (file.getType() != null) {
            try {
                mediaType = MediaType.parseMediaType(file.getType());
            } catch (Exception e) {
                // fallback
            }
        }
        
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(resource);
    }
}
