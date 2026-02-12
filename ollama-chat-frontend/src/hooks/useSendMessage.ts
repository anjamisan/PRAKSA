import { useState, useRef } from "react";
import { type Message, saveMessage, inferChatTitle, stopGeneration, sendChatMessage } from "../services/chatApi";

interface UseSendMessageOptions {
    selectedChatId: number | null;
    authToken: string | null;
    onCreateChat?: (title: string) => Promise<number>;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    selectedModel: string;
    sessionIdRef: React.RefObject<string>;
    currentChatIdRef: React.RefObject<number | null>;
    setChatTitle: React.Dispatch<React.SetStateAction<string>>;
    setChatCreated: React.Dispatch<React.SetStateAction<boolean>>;
    resetScroll: () => void;
}

interface UseSendMessageResult {
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    attachedImages: File[];
    setAttachedImages: React.Dispatch<React.SetStateAction<File[]>>;
    isGenerating: boolean;
    sendMessage: (newPrompt?: string) => Promise<void>;
    handleStopGeneration: () => Promise<void>;
}

export function useSendMessage(options: UseSendMessageOptions): UseSendMessageResult {
    const {
        selectedChatId,
        authToken,
        onCreateChat,
        setMessages,
        selectedModel,
        sessionIdRef,
        currentChatIdRef,
        setChatTitle,
        setChatCreated,
        resetScroll,
    } = options;

    const [input, setInput] = useState<string>("");
    const [attachedImages, setAttachedImages] = useState<File[]>([]);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const controllerRef = useRef<AbortController | null>(null);

    const sendMessage = async (newPrompt?: string) => {
        const prompt = newPrompt ?? input;
        const images = [...attachedImages];
        const imageNames = images.map((f) => `[image: ${f.name}]`).join("\n");
        const displayPrompt = [prompt, imageNames].filter(Boolean).join("\n");

        if (!prompt.trim() && images.length === 0) return;

        resetScroll();
        setIsGenerating(true);

        let chatId = selectedChatId;

        // Create chat if needed
        if (authToken && chatId == null && onCreateChat) {
            const inferredTitle = await inferChatTitle(prompt);
            setChatTitle(inferredTitle);
            try {
                const newId = await onCreateChat(inferredTitle);
                chatId = newId;
                setChatCreated(true);
                currentChatIdRef.current = newId;
            } catch (err) {
                console.error("Failed to create chat before sending message:", err);
            }
        }

        // Add user message and placeholder for assistant
        setMessages((prev) => [
            ...prev,
            { role: "user", content: displayPrompt },
            { role: "assistant", content: "" },
        ]);
        setInput("");
        setAttachedImages([]);

        // Save user message to database
        if (authToken && chatId != null) {
            try {
                await saveMessage(chatId, "user", displayPrompt, authToken);
            } catch (err) {
                console.error("Failed to save message to database:", err);
            }
        }

        // Abort previous request if exists
        controllerRef.current?.abort();
        if (controllerRef.current) {
            try {
                await stopGeneration(sessionIdRef.current);
            } catch (err) {
                console.warn("Failed to stop generation:", err);
            }
        }

        controllerRef.current = new AbortController();

        try {
            const response = await sendChatMessage(
                sessionIdRef.current,
                prompt,
                selectedModel,
                images,
                controllerRef.current.signal
            );

            if (!response.ok) throw new Error("Server error");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedContent += chunk;

                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage?.role === "assistant") {
                            lastMessage.content = accumulatedContent;
                        }
                        return newMessages;
                    });
                }

                // Save assistant response to database
                if (authToken && accumulatedContent && chatId != null) {
                    await saveMessage(chatId, "assistant", accumulatedContent, authToken);
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === "assistant") {
                    lastMessage.content = "Error: Unable to connect to server";
                }
                return newMessages;
            });
        } finally {
            controllerRef.current = null;
            setIsGenerating(false);
            resetScroll();
        }
    };

    const handleStopGeneration = async () => {
        controllerRef.current?.abort();
        controllerRef.current = null;

        try {
            await stopGeneration(sessionIdRef.current);
        } catch (err) {
            console.warn("Stop request failed:", err);
        }

        if (input.trim()) {
            await sendMessage(input);
        }
    };

    return {
        input,
        setInput,
        attachedImages,
        setAttachedImages,
        isGenerating,
        sendMessage,
        handleStopGeneration,
    };
}
