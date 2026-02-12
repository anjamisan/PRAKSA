import { useState } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ModelPicker from "./ModelPicker";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useChatMessages } from "../hooks/useChatMessages";
import { useSendMessage } from "../hooks/useSendMessage";

interface ChatProps {
    selectedChatId: number | null;
    authToken: string | null;
    onCreateChat?: (title: string) => Promise<number>;
}

const Chat: React.FC<ChatProps> = ({ selectedChatId, authToken, onCreateChat }) => {
    const [selectedModel, setSelectedModel] = useState<string>("ministral-3:14b-cloud");

    // Chat messages and state
    const {
        messages,
        setMessages,
        setChatTitle,
        setChatCreated,
        sessionIdRef,
        currentChatIdRef,
    } = useChatMessages(selectedChatId, authToken);

    // Auto-scroll behavior (must be before useSendMessage since it provides resetScroll)
    const { messagesEndRef, messagesContainerRef, resetScroll } = useAutoScroll(messages);

    // Message sending logic
    const {
        input,
        setInput,
        attachedImages,
        setAttachedImages,
        sendMessage,
        handleStopGeneration,
    } = useSendMessage({
        selectedChatId,
        authToken,
        onCreateChat,
        messages,
        setMessages,
        selectedModel,
        sessionIdRef,
        currentChatIdRef,
        setChatTitle,
        setChatCreated,
        resetScroll,
    });

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
                    onStop={handleStopGeneration}
                />
            </div>
        </div>
    );
};

export default Chat;