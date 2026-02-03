import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


// Message type
type Message = {
    role: "user" | "assistant";
    content: string;
};

interface ChatProps {
    selectedChatId: number | null;
    authToken: string | null;
    // Returns the new chat's ID when a chat is created
    onCreateChat?: (title: string) => Promise<number>;
}

const Chat: React.FC<ChatProps> = ({ selectedChatId, authToken, onCreateChat }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const [chatTitle, setChatTitle] = useState<string>("New Chat");
    const [chatCreated, setChatCreated] = useState<boolean>(false);
    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const controllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentChatIdRef = useRef<number | null>(null); //handles the scenario where the user clicks on the same chat
    //or makes a new chat, to avoid refetching messages unnecessarily
    //WHENEVER selectedChatId changes, we check if it's different from currentChatIdRef.current
    //in the case where we make a new chat, without currentChatIdRef.current,
    //the creation of the chatid would trigger an useffect which would fetch the messages from the database 
    //before they were even stored


    /////////////////////Scroll to bottom whenever messages change//////////////////////

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    ////////////////////////Handle chat switching and new chat creation//////////////////

    useEffect(() => {
        console.log("Selected chat ID changed to:", selectedChatId);
        if (selectedChatId === null) {
            // New chat: reset everything
            setMessages([]);
            setChatTitle("New Chat");
            setChatCreated(false);
            currentChatIdRef.current = null;
            sessionIdRef.current = crypto.randomUUID();
        } else if (authToken && selectedChatId !== currentChatIdRef.current) {
            // Switching to a different existing chat: fetch messages from backend
            console.log("Fetching messages for chat ID:", selectedChatId);
            const fetchMessages = async () => {
                try {
                    const res = await fetch(`http://localhost:8000/chats/${selectedChatId}`, {
                        headers: { Authorization: `Bearer ${authToken}` },
                    });
                    if (!res.ok) throw new Error("Failed to fetch messages");

                    const data = await res.json();
                    const messagesArray = Array.isArray(data) ? data : [];
                    setMessages(messagesArray);
                    console.log("Fetched messages:", messagesArray);
                    setChatCreated(true);
                    currentChatIdRef.current = selectedChatId; // Update current chat ID so we don't refetch unnecessarily
                    sessionIdRef.current = crypto.randomUUID();
                } catch (err) {
                    console.error(err);
                    setMessages([{ role: "assistant", content: "Error loading chat" }]);
                }
            };

            fetchMessages();
        }
    }, [selectedChatId, authToken]); //!!!!!!!!!!!!!!!!!!

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

    ////////////////////////////////////SEND MESSAGE/////////////////////////////////////
    //////////////////////////////Chat creation will be handled inside sendMessage///////////////////////

    const sendMessage = async (newPrompt?: string) => {
        const prompt = newPrompt ?? input;
        if (!prompt.trim()) return;

        // If logged in and no chat yet, create chat first
        let chatId = selectedChatId;
        if (authToken && chatId == null && onCreateChat) { //oncreatechat is generally never undefined if there is an authtoken
            // Infer a title from the prompt
            const inferredTitle = prompt.substring(0, 50) + (prompt.length > 50 ? "..." : "");
            setChatTitle(inferredTitle);
            try {
                const newId = await onCreateChat(inferredTitle);
                chatId = newId;
                setChatCreated(true);
                currentChatIdRef.current = newId; // Prevent useEffect from fetching and overwriting messages
                console.log("Created new chat with ID:", newId);
            } catch (err) {
                console.error("Failed to create chat before sending message:", err);
            }
        }

        // Update UI with user + placeholder assistant message
        setMessages((prev) => [
            ...prev,
            { role: "user", content: prompt },
            { role: "assistant", content: "" },
        ]);
        setInput("");


        // Save user message to database once we know chatId (works for new and existing chats)
        if (authToken && chatId != null) {
            await saveMessageToDatabase(chatId, "user", prompt);
            console.log("Saved user message to database");
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
            console.log("Sending message to backend:", prompt);
            const response = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionIdRef.current, message: prompt }),
                signal: controllerRef.current.signal,
            });
            console.log("Received response from backend");
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
                        // Check if lastMessage exists before accessing its properties
                        if (lastMessage?.role === "assistant") {
                            lastMessage.content = accumulatedContent;
                        }
                        return newMessages;
                    });
                }
                // Save assistant message to database after streaming completes
                if (authToken && accumulatedContent && (chatId != null)) {
                    await saveMessageToDatabase(chatId, "assistant", accumulatedContent);
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

    ////////////////////////////Handle stopping generation///////////////////////

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
        <div className="flex flex-col h-full bg-gray-100 p-6">
            <div className="flex flex-col w-full h-full border rounded-xl shadow-lg bg-white overflow-hidden">
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
                            className={`max-w-[70%] p-3 rounded-lg break-words ${msg.role === "user"
                                ? "bg-blue-200 ml-auto"
                                : "bg-white mr-auto"
                                }`}
                        >
                            {msg.role === "assistant" ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    className="
                                        prose prose-base max-w-none
                                        prose-table:block
                                        prose-table:overflow-x-auto
                                        prose-table:rounded-lg
                                        prose-table:border
                                        prose-table:border-gray-200
                                        prose-thead:bg-gray-50
                                        prose-th:border prose-th:border-gray-200
                                        prose-td:border prose-td:border-gray-200
                                        prose-th:px-3 prose-th:py-2
                                        prose-td:px-3 prose-td:py-2
                                        prose-th:text-left
                                        prose-th:font-semibold
                                        prose-tr:even:bg-gray-50
                                        prose-td:break-words 
                                        prose-th:break-words
                                        "
                                >
                                    {msg.content}
                                </ReactMarkdown>

                            ) : (
                                msg.content
                            )}
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
