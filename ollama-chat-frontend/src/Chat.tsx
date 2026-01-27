import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";

// Message type
type Message = {
    role: "user" | "assistant";
    content: string;
};

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const controllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (newPrompt?: string) => {
        const prompt = newPrompt ?? input;
        if (!prompt.trim()) return;

        setMessages((prev) => [
            ...prev,
            { role: "user", content: prompt },
            { role: "assistant", content: "" },
        ]);
        setInput("");

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
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
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
