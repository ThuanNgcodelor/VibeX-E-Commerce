package com.example.orderservice.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TrackingEmitterService {
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String orderId) {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.computeIfAbsent(orderId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(orderId, emitter));
        emitter.onTimeout(() -> removeEmitter(orderId, emitter));
        emitter.onError((e) -> removeEmitter(orderId, emitter));
        return emitter;
    }

    private void removeEmitter(String orderId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(orderId);
        if (list != null) {
            list.remove(emitter);
        }
    }

    public void send(String orderId, Object event) {
        List<SseEmitter> list = emitters.get(orderId);
        if (list == null || list.isEmpty()) return;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name("tracking").data(event));
            } catch (IOException e) {
                removeEmitter(orderId, emitter);
            }
        }
    }
}


