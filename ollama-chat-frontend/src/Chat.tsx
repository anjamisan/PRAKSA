import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";

// Message type
type Message = {
    role: "user" | "assistant";
    content: string;
};

interface ChatProps {
    selectedChatId: number | null;
    authToken: string | null;
    onCreateChat?: (title: string) => Promise<void>;
}

const Chat: React.FC<ChatProps> = ({ selectedChatId, authToken, onCreateChat }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const [chatTitle, setChatTitle] = useState<string>("New Chat");
    const [chatCreated, setChatCreated] = useState<boolean>(false);
    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const controllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);



    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    ////handle chat switching

    useEffect(() => {
        if (selectedChatId !== null && authToken) {
            // Fetch messages for the selected chat
            const fetchMessages = async () => {
                try {
                    const res = await fetch(`http://localhost:8000/chats/${selectedChatId}`, {
                        headers: { Authorization: `Bearer ${authToken}` },
                    });
                    if (!res.ok) throw new Error("Failed to fetch messages");

                    const data = await res.json();
                    // Handle case where backend returns null or not an array
                    const messagesArray = Array.isArray(data) ? data : [];
                    setMessages(messagesArray);
                    setChatCreated(true);
                    sessionIdRef.current = crypto.randomUUID();
                } catch (err) {
                    console.error(err);
                    setMessages([{ role: "assistant", content: "Error loading chat" }]);
                }
            };

            fetchMessages();
        }
    }, [selectedChatId, authToken]);


    /// Handle new chat

    useEffect(() => {
        if (selectedChatId === null) {
            setMessages([]);
            setChatTitle("New Chat");
            setChatCreated(false);
            sessionIdRef.current = crypto.randomUUID(); // new session ID for new chat
        } else {
            // optional: fetch existing messages for selected chat
        }
    }, [selectedChatId]);


    // Handle chat creation when first message is sent
    useEffect(() => {
        if (!chatCreated && messages.length > 0 && authToken && onCreateChat) {
            // Infer title from first user message (first 50 characters)
            const firstUserMessage = messages.find(m => m.role === "user");
            if (firstUserMessage) {
                const inferredTitle = firstUserMessage.content.substring(0, 50) +
                    (firstUserMessage.content.length > 50 ? "..." : "");
                setChatTitle(inferredTitle);
                setChatCreated(true);
                onCreateChat(inferredTitle);
            }
        }
    }, [messages, chatCreated, authToken, onCreateChat]);

    const saveMessageToDatabase = async (chatId: number, role: string, content: string) => {
        if (!authToken) return;

        try {
            await fetch(`http://localhost:8000/chats/${chatId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ role, content }),
            });
        } catch (err) {
            console.error("Failed to save message to database:", err);
        }
    };

    const sendMessage = async (newPrompt?: string) => {
        const prompt = newPrompt ?? input;
        if (!prompt.trim()) return;

        setMessages((prev) => [
            ...prev,
            { role: "user", content: prompt },
            { role: "assistant", content: "" },
        ]);
        setInput("");

        // Save user message to database if logged in and chat exists
        if (authToken && selectedChatId) {
            await saveMessageToDatabase(selectedChatId, "user", prompt);
        }

        controllerRef.current?.abort();

        // If there's an ongoing request, call /stop to tell backend to stop generation
        if (controllerRef.current) {
            try {
                await fetch("http://localhost:8000/stop", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_id: sessionIdRef.current }),
                });
            } catch (err) {
                // Ignore errors from /stop call
                console.warn("Failed to stop generation:", err);
            }
        }

        controllerRef.current = new AbortController();

        try {
            const response = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionIdRef.current, message: prompt }),
                signal: controllerRef.current.signal,
            });

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
                        if (lastMessage.role === "assistant") {
                            lastMessage.content = accumulatedContent;
                        }
                        return newMessages;
                    });
                }

                // Save assistant message to database after streaming completes
                if (authToken && selectedChatId && accumulatedContent) {
                    await saveMessageToDatabase(selectedChatId, "assistant", accumulatedContent);
                }
            }
        } catch (err) {
            // AbortController → user clicked Stop → do NOTHING
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }

            // Any other error → show message
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
        }
    };

    const stopGeneration = async () => {
        controllerRef.current?.abort();
        controllerRef.current = null;

        try {
            await fetch("http://localhost:8000/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionIdRef.current }),
            });
        } catch (err) {
            console.warn("Stop request failed:", err);
        }

        if (input.trim()) sendMessage(input);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") sendMessage();
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 justify-center items-center">
            <div className="flex flex-col w-full max-w-xl h-4/5 border rounded-xl shadow-lg bg-white overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 relative">
                    {messages.length === 0 && selectedChatId === null && (
                        <div className="absolute inset-0 flex justify-center items-center text-gray-400 text-sm">
                            Start a new chat
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`max-w-[70%] p-3 rounded-lg break-words ${msg.role === "user" ? "bg-blue-200 ml-auto" : "bg-white mr-auto"
                                }`}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {/* Scroll target */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="flex flex-col p-4 bg-white border-t">
                    <div className="flex space-x-2 justify-center">
                        <input
                            type="text"
                            className="flex-1 p-3 border rounded-md focus:outline-none"
                            placeholder="Type your message..."
                            value={input}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            onClick={() => sendMessage()}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            Send
                        </button>
                        <button
                            onClick={stopGeneration}
                            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
