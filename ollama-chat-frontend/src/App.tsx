import { useState, useEffect } from "react";
import Chat from "./Chat";
import NavBar from "./NavBar";
import Sidebar from "./Sidebar";
import AuthModal from "./AuthModal";

interface ChatSession {
  id: number;
  title: string;
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  ////////////////////////Load token from localStorage on mount////////////////////////

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const email = localStorage.getItem("userEmail");
    if (token) {
      setAuthToken(token);
      setUserEmail(email);
      setIsLoggedIn(true);
      fetchChats(token);
    }
  }, []);

  /////////////////////////fetch user chats////////////////////////

  const fetchChats = async (token: string) => {
    try {
      const response = await fetch("http://localhost:8000/chats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  ///////////////////////Authentication handlers////////////////////////

  const handleAuth = async (email: string, password: string) => {
    const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Authentication failed");
      }

      const data = await response.json();
      const token = data.access_token;

      localStorage.setItem("authToken", token);
      localStorage.setItem("userEmail", email);
      setAuthToken(token);
      setUserEmail(email);
      setIsLoggedIn(true);
      setShowAuthModal(false);
      setChats([]);
      setSelectedChatId(null);
      await fetchChats(token);
    } catch (err) {
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    setAuthToken(null);
    setUserEmail(null);
    setIsLoggedIn(false);
    setChats([]);
    setSelectedChatId(null);
  };

  //////////////////////////Chat handlers////////////////////////////////

  const handleNewChat = () => {
    setSelectedChatId(null);
  };

  const handleCreateChat = async (title: string) => {
    if (!authToken) return;

    try {
      const response = await fetch("http://localhost:8000/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title }),
      });

      if (response.ok) {
        const newChat = await response.json();
        setChats((prev) => [...prev, newChat]);
        setSelectedChatId(newChat.id);
      }
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  const handleSelectChat = (chatId: number) => {
    setSelectedChatId(chatId);
  };

  const handleDeleteChat = async (chatId: number) => {
    if (!authToken) return;

    try {
      const response = await fetch(`http://localhost:8000/chats/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  ///////////////////////////Rendering////////////////////////////////

  return (
    <div className="flex flex-col h-screen">
      <NavBar
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        onLoginClick={() => {
          setAuthMode("login");
          setShowAuthModal(true);
        }}
        onRegisterClick={() => {
          setAuthMode("register");
          setShowAuthModal(true);
        }}
        onLogoutClick={handleLogout}
      />

      <AuthModal
        isOpen={showAuthModal}
        isLogin={authMode === "login"}
        onClose={() => setShowAuthModal(false)}
        onSubmit={handleAuth}
      />

      <div className="flex flex-1 overflow-hidden">
        {isLoggedIn && (
          <>
            <div
              className={`${sidebarOpen ? "w-64" : "w-0"
                } transition-all duration-300 overflow-hidden`}
            >
              <Sidebar
                chats={chats}
                selectedChatId={selectedChatId}
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                onNewChat={handleNewChat}
              />
            </div>
          </>
        )}

        <div className="flex-1 overflow-hidden">
          <Chat
            selectedChatId={selectedChatId}
            authToken={authToken}
            onCreateChat={isLoggedIn ? handleCreateChat : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default App;