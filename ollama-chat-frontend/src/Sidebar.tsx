import { useState, type FormEvent } from "react";
import { Trash2, Plus } from "lucide-react";

interface ChatSession {
  id: number;
  title: string;
}

interface SidebarProps {
  chats: ChatSession[];
  selectedChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onDeleteChat: (chatId: number) => Promise<void>;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
}) => {
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (chatId: number) => {
    setDeleting(chatId);
    try {
      await onDeleteChat(chatId);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen p-4 overflow-hidden">
      <button
        onClick={onNewChat}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-md mb-4 text-white font-medium"
      >
        <Plus size={18} />
        New Chat
      </button>

      <div className="flex-1 overflow-y-auto space-y-2">
        {chats.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No chats yet</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center justify-between p-3 rounded-md cursor-pointer group ${
                selectedChatId === chat.id
                  ? "bg-gray-700"
                  : "hover:bg-gray-800 bg-gray-800"
              }`}
            >
              <button
                onClick={() => onSelectChat(chat.id)}
                className="flex-1 text-left truncate text-sm"
                title={chat.title}
              >
                {chat.title}
              </button>
              <button
                onClick={() => handleDelete(chat.id)}
                disabled={deleting === chat.id}
                className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
