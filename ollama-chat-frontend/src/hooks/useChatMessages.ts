import { useState, useEffect, useRef } from "react";
import { type Message, fetchChatMessages } from "../services/chatApi";

interface UseChatMessagesResult {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    chatTitle: string;
    setChatTitle: React.Dispatch<React.SetStateAction<string>>;
    chatCreated: boolean;
    setChatCreated: React.Dispatch<React.SetStateAction<boolean>>;
    sessionIdRef: React.MutableRefObject<string>;
    currentChatIdRef: React.MutableRefObject<number | null>;
}

export function useChatMessages(
    selectedChatId: number | null,
    authToken: string | null
): UseChatMessagesResult {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatTitle, setChatTitle] = useState<string>("New Chat");
    const [chatCreated, setChatCreated] = useState<boolean>(false);

    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const currentChatIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (selectedChatId === null) {
            // Reset for new chat
            setMessages([]);
            setChatTitle("New Chat");
            setChatCreated(false);
            currentChatIdRef.current = null;
            sessionIdRef.current = crypto.randomUUID();
        } else if (authToken && selectedChatId !== currentChatIdRef.current) {
            // Fetch messages for selected chat
            const loadMessages = async () => {
                try {
                    const messagesArray = await fetchChatMessages(selectedChatId, authToken);
                    setMessages(messagesArray);
                    setChatCreated(true);
                    currentChatIdRef.current = selectedChatId;
                    sessionIdRef.current = crypto.randomUUID();
                } catch (err) {
                    console.error(err);
                    setMessages([{ role: "assistant", content: "Error loading chat" }]);
                }
            };
            loadMessages();
        }
    }, [selectedChatId, authToken]);

    return {
        messages,
        setMessages,
        chatTitle,
        setChatTitle,
        chatCreated,
        setChatCreated,
        sessionIdRef,
        currentChatIdRef,
    };
}
