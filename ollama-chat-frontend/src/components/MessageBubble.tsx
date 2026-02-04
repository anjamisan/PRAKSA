import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
    role: "user" | "assistant";
    content: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content }) => {
    return (
        <div
            className={`max-w-[70%] p-3 rounded-lg break-words ${role === "user" ? "bg-blue-200 ml-auto" : "bg-white mr-auto"
                }`}
        >
            {role === "assistant" ? (
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
                    {content}
                </ReactMarkdown>
            ) : (
                content
            )}
        </div>
    );
};

export default MessageBubble;
