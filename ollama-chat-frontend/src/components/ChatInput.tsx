import { useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import ImageAttachments from "./ImageAttachments";

interface ChatInputProps {
    input: string;
    attachedImages: File[];
    onInputChange: (value: string) => void;
    onImagesChange: (images: File[]) => void;
    onSend: () => void;
    onStop: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
    input,
    attachedImages,
    onInputChange,
    onImagesChange,
    onSend,
    onStop,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return;
        onImagesChange([...attachedImages, ...images]);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handlePickImages = () => fileInputRef.current?.click();

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") onSend();
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onInputChange(e.target.value);
    };

    return (
        <div className="flex flex-col p-4 bg-white border-t">
            <ImageAttachments images={attachedImages} />

            <div
                className={`flex space-x-2 justify-center ${isDragging ? "ring-2 ring-blue-400 rounded-md" : ""
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <button
                    type="button"
                    onClick={handlePickImages}
                    className="p-3 border rounded-md text-gray-600 hover:bg-gray-50"
                    title="Insert image"
                >
                    <ImagePlus size={18} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <input
                    type="text"
                    className="flex-1 p-3 border rounded-md focus:outline-none"
                    placeholder="Type your message..."
                    value={input}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                />
                <button
                    onClick={onSend}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                    Send
                </button>
                <button
                    onClick={onStop}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                    Stop
                </button>
            </div>
        </div>
    );
};

export default ChatInput;
