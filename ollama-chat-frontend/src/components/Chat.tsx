import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ModelPicker from "./ModelPicker";

type Message = {
    role: "user" | "assistant";
    content: string;
};

interface ChatProps {
    selectedChatId: number | null;
    authToken: string | null;
    onCreateChat?: (title: string) => Promise<number>;
}

const Chat: React.FC<ChatProps> = ({ selectedChatId, authToken, onCreateChat }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const [attachedImages, setAttachedImages] = useState<File[]>([]);
    const [chatTitle, setChatTitle] = useState<string>("New Chat");
    const [chatCreated, setChatCreated] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false); //to track if we're currently waiting for a response from the backend
    const [userHasScrolled, setUserHasScrolled] = useState<boolean>(false); //to stop automatic scrolling when user scrolls up during generation
    const [selectedModel, setSelectedModel] = useState<string>("ministral-3:14b-cloud");
    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const controllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const currentChatIdRef = useRef<number | null>(null);//handles the scenario where the user clicks on the same chat
    //or makes a new chat, to avoid refetching messages unnecessarily
    //WHENEVER selectedChatId changes, we check if it's different from currentChatIdRef.current
    //in the case where we make a new chat, without currentChatIdRef.current,
    //the creation of the chatid would trigger an useffect which would fetch the messages from the database
    //before they were even stored

    /////////////////////Scroll to bottom whenever messages change//////////////////////

    useEffect(() => {
        if (!userHasScrolled) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, userHasScrolled]);

    // Detect user scroll during generation
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isGenerating) {
                const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
                if (!isAtBottom) {
                    setUserHasScrolled(true);
                } else {
                    setUserHasScrolled(false);
                }
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [isGenerating]);

    ////////////////////////Handle chat switching and new chat creation//////////////////

    useEffect(() => {
        console.log("Selected chat ID changed to:", selectedChatId);
        if (selectedChatId === null) {
            setMessages([]);
            setChatTitle("New Chat");
            setChatCreated(false);
            currentChatIdRef.current = null;
            sessionIdRef.current = crypto.randomUUID();
        } else if (authToken && selectedChatId !== currentChatIdRef.current) {
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
    }, [selectedChatId, authToken]);

    ////////////////////////Save message to database////////////////////////

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

    ////////////////////////Infer chat title from prompt/////////////////////////////////////////

    const inferChatTitle = async (prompt: string): Promise<string> => {
        try {
            const response = await fetch("http://localhost:8000/title", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt }),
            });
            if (!response.ok)
                throw new Error("Failed to generate title");
            const data = await response.json();
            return data.title || prompt.substring(0, 50) + (prompt.length > 50 ? "..." : "");
        } catch (err) {
            console.error("Failed to infer chat title:", err);
            return prompt.substring(0, 50) + (prompt.length > 50 ? "..." : "");
        }
    };

    ////////////////////////////////////SEND MESSAGE/////////////////////////////////////
    //////////////////////////////Chat creation will be handled inside sendMessage///////////////////////


    const sendMessage = async (newPrompt?: string) => {
        const prompt = newPrompt ?? input;
        const images = [...attachedImages];
        const imageNames = images.map((f) => `[image: ${f.name}]`).join("\n");
        const displayPrompt = [prompt, imageNames].filter(Boolean).join("\n");
        if (!prompt.trim() && images.length === 0) return;

        // Reset scroll tracking when sending a new message
        setUserHasScrolled(false);
        setIsGenerating(true);

        let chatId = selectedChatId;
        if (authToken && chatId == null && onCreateChat) {
            const inferredTitle = await inferChatTitle(prompt);
            setChatTitle(inferredTitle);
            try {
                const newId = await onCreateChat(inferredTitle); //here we wait for the chat to be created
                //aka the id to be set, so we can immediately use it to save the first messages
                chatId = newId;
                setChatCreated(true);
                currentChatIdRef.current = newId;
                console.log("Created new chat with ID:", newId);
            } catch (err) {
                console.error("Failed to create chat before sending message:", err);
            }
        }

        setMessages((prev) => [
            ...prev,
            { role: "user", content: displayPrompt },
            { role: "assistant", content: "" },
        ]);
        setInput("");
        setAttachedImages([]);

        if (authToken && chatId != null) {
            await saveMessageToDatabase(chatId, "user", displayPrompt);
            console.log("Saved user message to database");
        }

        controllerRef.current?.abort();

        if (controllerRef.current) {
            try {
                await fetch("http://localhost:8000/stop", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_id: sessionIdRef.current }),
                });
            } catch (err) {
                console.warn("Failed to stop generation:", err);
            }
        }

        controllerRef.current = new AbortController();

        try {
            console.log("Sending message to backend:", prompt);

            ////////////////////DECISION BETWEEN SENDING FORM-DATA OR JSON////////////////////

            let response: Response;

            if (images.length > 0) {
                console.log("Sending images with the message, using FormData"); //ovde dodje
                // Use FormData for multipart request with images
                const formData = new FormData();
                formData.append("session_id", sessionIdRef.current);
                formData.append("message", prompt);
                formData.append("model_index", selectedModel);
                images.forEach((image) => {
                    formData.append("images", image);
                });

                response = await fetch("http://localhost:8000/chat", {
                    method: "POST",
                    body: formData,
                    signal: controllerRef.current.signal,
                });
            } else {
                // Use JSON for text-only request
                response = await fetch("http://localhost:8000/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        session_id: sessionIdRef.current,
                        message: prompt,
                        model_index: selectedModel,
                    }),
                    signal: controllerRef.current.signal,
                });
            }

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
                        if (lastMessage?.role === "assistant") {
                            lastMessage.content = accumulatedContent;
                        }
                        return newMessages;
                    });
                }
                if (authToken && accumulatedContent && chatId != null) {
                    await saveMessageToDatabase(chatId, "assistant", accumulatedContent);
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
            setUserHasScrolled(false);
        }
    };

    ////////////////////////////////////STOP MESSAGE/////////////////////////////////////

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

    return (
        <div className="flex flex-col h-full bg-gray-100 p-6">
            <div className="flex flex-col w-full h-full border rounded-xl shadow-lg bg-white overflow-hidden">
                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 relative"
                >
                    {messages.length === 0 && selectedChatId === null && (
                        <div className="absolute inset-0 flex justify-center items-center text-gray-400 text-sm">
                            Start a new chat
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <MessageBubble key={i} role={msg.role} content={msg.content} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Model picker */}
                <div className="px-6 py-2 border-t bg-white">
                    <div className="flex items-center justify-between">
                        <ModelPicker value={selectedModel} onChange={setSelectedModel} />
                        {(selectedModel === "llama3.2:latest" || selectedModel === "gpt-oss:120b-cloud") && (
                            <span className="text-xs text-amber-600">
                                This model can't analyze photos.
                            </span>
                        )}
                    </div>
                </div>

                {/* Input area */}
                <ChatInput
                    input={input}
                    attachedImages={attachedImages}
                    onInputChange={setInput}
                    onImagesChange={setAttachedImages}
                    onSend={() => sendMessage()}
                    onStop={stopGeneration}
                />
            </div>
        </div>
    );
};

export default Chat;