package com.example.notificationservice.service;

import com.example.notificationservice.client.StockServiceClient;
import com.example.notificationservice.client.UserServiceClient;
import com.example.notificationservice.dto.*;
import com.example.notificationservice.enums.ConversationStatus;
import com.example.notificationservice.model.Conversation;
import com.example.notificationservice.model.Message;
import com.example.notificationservice.repository.ConversationRepository;
import com.example.notificationservice.repository.MessageRepository;
import com.example.notificationservice.request.SendMessageRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {
    
    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;
    private final UserServiceClient userServiceClient;
    private final StockServiceClient stockServiceClient;
    private final WebSocketChatService webSocketChatService;
    
    /**
     * Lấy hoặc tạo conversation
     * QUAN TRỌNG: Phân biệt theo product
     */
    @Transactional
    public ConversationDto getOrCreateConversation(
        String clientId, 
        String shopOwnerId, 
        String productId  // Có thể NULL nếu chat chung
    ) {
        Optional<Conversation> existing;
        
        if (productId != null && !productId.trim().isEmpty()) {
            // Chat về sản phẩm cụ thể
            existing = conversationRepo.findByClientIdAndShopOwnerIdAndProductId(
                clientId, shopOwnerId, productId
            );
        } else {
            // Chat chung (không gắn product)
            existing = conversationRepo.findGeneralConversation(
                clientId, shopOwnerId
            );
        }
        
        Conversation conversation;
        if (existing.isPresent()) {
            conversation = existing.get();
        } else {
            // Tạo mới
            conversation = new Conversation();
            conversation.setClientId(clientId);
            conversation.setShopOwnerId(shopOwnerId);
            conversation.setProductId(productId);
            conversation.setStatus(ConversationStatus.ACTIVE);
            
            // Auto-generate title
            try {
                if (productId != null && !productId.trim().isEmpty()) {
                    var productResponse = stockServiceClient.getProductById(productId);
                    if (productResponse.getBody() != null) {
                        conversation.setTitle("Ask about " + productResponse.getBody().getName());
                    }
                } else {
                    var userResponse = userServiceClient.getUserById(shopOwnerId);
                    if (userResponse.getBody() != null) {
                        conversation.setTitle("Chat with " + userResponse.getBody().getUsername());
                    }
                }
            } catch (Exception e) {
                conversation.setTitle("New Conversation");
            }
            
            conversation = conversationRepo.save(conversation);
        }
        
        return mapToDto(conversation, clientId);
    }
    
    /**
     * Lấy danh sách conversations
     * Enrich với thông tin product
     */
    public List<ConversationDto> getConversations(String userId) {
        List<Conversation> conversations = conversationRepo.findByUserId(userId);
        
        return conversations.stream()
            .map(conv -> mapToDto(conv, userId))
            .collect(Collectors.toList());
    }
    
    /**
     * Lấy messages của conversation
     */
    public List<MessageDto> getMessages(String conversationId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        List<Message> messages = messageRepo.findLatestMessages(conversationId, pageable);
        
        return messages.stream()
            .map(this::mapToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Gửi message
     */
    @Transactional
    public MessageDto sendMessage(String senderId, SendMessageRequest request) {
        // Lấy conversation
        Conversation conversation = conversationRepo.findById(request.getConversationId())
            .orElseThrow(() -> new RuntimeException("Conversation not found"));
        
        // Xác định sender type
        // Nếu sender là client của conversation thì là CLIENT, ngược lại là SHOP_OWNER
        Message.SenderType senderType = conversation.getClientId().equals(senderId)
            ? Message.SenderType.CLIENT
            : Message.SenderType.SHOP_OWNER;
        
        // Tạo message
        Message message = Message.builder()
            .conversationId(request.getConversationId())
            .senderId(senderId)
            .senderType(senderType)
            .messageType(request.getMessageType())
            .content(request.getContent())
            .imageId(request.getImageId())
            .productId(request.getProductId())
            .isRead(false)
            .deliveryStatus(Message.DeliveryStatus.SENT)
            .build();
        
        message = messageRepo.save(message);
        
        // Cập nhật conversation
        conversation.setLastMessageContent(request.getContent());
        conversation.setLastMessageSenderId(senderId);
        conversation.setLastMessageAt(LocalDateTime.now());
        
        // Tăng unread count cho người nhận
        String receiverId = conversation.getClientId().equals(senderId)
            ? conversation.getShopOwnerId()
            : conversation.getClientId();
        
        if (conversation.getClientId().equals(receiverId)) {
            conversation.setClientUnreadCount(
                (conversation.getClientUnreadCount() != null ? conversation.getClientUnreadCount() : 0) + 1
            );
        } else {
            conversation.setShopOwnerUnreadCount(
                (conversation.getShopOwnerUnreadCount() != null ? conversation.getShopOwnerUnreadCount() : 0) + 1
            );
        }
        
        conversationRepo.save(conversation);
        
        // Push qua WebSocket
        MessageDto messageDto = mapToDto(message);
        webSocketChatService.sendMessageToConversation(request.getConversationId(), messageDto);
        
        return messageDto;
    }
    
    /**
     * Đánh dấu messages là đã đọc
     */
    @Transactional
    public void markMessagesAsRead(String conversationId, String userId) {
        messageRepo.markMessagesAsRead(conversationId, userId);
        
        // Cập nhật unread count trong conversation
        Conversation conversation = conversationRepo.findById(conversationId)
            .orElseThrow(() -> new RuntimeException("Conversation not found"));
        
        if (conversation.getClientId().equals(userId)) {
            conversation.setClientUnreadCount(0);
        } else {
            conversation.setShopOwnerUnreadCount(0);
        }
        
        conversationRepo.save(conversation);
    }
    
    // Helper methods
    private ConversationDto mapToDto(Conversation conv, String currentUserId) {
        ConversationDto dto = ConversationDto.builder()
            .id(conv.getId())
            .clientId(conv.getClientId())
            .shopOwnerId(conv.getShopOwnerId())
            .productId(conv.getProductId())
            .title(conv.getTitle())
            .lastMessageContent(conv.getLastMessageContent())
            .lastMessageSenderId(conv.getLastMessageSenderId())
            .lastMessageAt(conv.getLastMessageAt())
            .clientUnreadCount(conv.getClientUnreadCount())
            .shopOwnerUnreadCount(conv.getShopOwnerUnreadCount())
            .status(conv.getStatus().name())
            .build();
        
        // Tính unread count cho current user
        int unreadCount = conv.getClientId().equals(currentUserId)
            ? (conv.getClientUnreadCount() != null ? conv.getClientUnreadCount() : 0)
            : (conv.getShopOwnerUnreadCount() != null ? conv.getShopOwnerUnreadCount() : 0);
        dto.setUnreadCount(unreadCount);
        
        // Lấy thông tin opponent
        try {
            String opponentId = conv.getClientId().equals(currentUserId)
                ? conv.getShopOwnerId()
                : conv.getClientId();
            var opponentResponse = userServiceClient.getUserById(opponentId);
            if (opponentResponse.getBody() != null) {
                dto.setOpponent(opponentResponse.getBody());
            }
        } catch (Exception e) {
            log.error("Error fetching opponent: {}", e.getMessage());
            // Set default opponent để frontend không hiển thị "Unknown"
            UserDto defaultOpponent = UserDto.builder()
                .id(conv.getClientId().equals(currentUserId) ? conv.getShopOwnerId() : conv.getClientId())
                .username(conv.getClientId().equals(currentUserId) ? "Shop Owner" : "Client")
                .build();
            dto.setOpponent(defaultOpponent);
        }
        
        // Lấy thông tin product nếu có
        if (conv.getProductId() != null) {
            try {
                var productResponse = stockServiceClient.getProductById(conv.getProductId());
                if (productResponse.getBody() != null) {
                    dto.setProduct(productResponse.getBody());
                }
            } catch (Exception e) {
                log.error("Error fetching product: {}", e.getMessage());
            }
        }
        
        return dto;
    }
    
    private MessageDto mapToDto(Message message) {
        MessageDto dto = MessageDto.builder()
            .id(message.getId())
            .conversationId(message.getConversationId())
            .senderId(message.getSenderId())
            .senderType(message.getSenderType())
            .messageType(message.getMessageType())
            .content(message.getContent())
            .imageId(message.getImageId())
            .productId(message.getProductId())
            .isRead(message.getIsRead())
            .readAt(message.getReadAt())
            .deliveryStatus(message.getDeliveryStatus())
            .createdAt(message.getCreatedAt())
            .build();
        
        // Lấy sender name
        try {
            var senderResponse = userServiceClient.getUserById(message.getSenderId());
            if (senderResponse.getBody() != null) {
                dto.setSenderName(senderResponse.getBody().getUsername());
            } else {
                dto.setSenderName("User");
            }
        } catch (Exception e) {
            log.error("Error fetching sender: {}", e.getMessage());
            dto.setSenderName("User");
        }
        
        return dto;
    }
}

