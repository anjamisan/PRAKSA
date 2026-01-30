import { LogOut, Menu, User } from "lucide-react";

interface NavBarProps {
    isLoggedIn: boolean;
    userEmail: string | null;
    onLoginClick: () => void;
    onRegisterClick: () => void;
    onLogoutClick: () => void;
    onSidebarToggle?: () => void;
}

const NavBar: React.FC<NavBarProps> = ({
    isLoggedIn,
    userEmail,
    onLoginClick,
    onRegisterClick,
    onLogoutClick,
    onSidebarToggle,
}) => {
    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                    {isLoggedIn && onSidebarToggle && (
                        <button
                            onClick={onSidebarToggle}
                            className="p-2 hover:bg-gray-100 rounded-md text-gray-600 lg:hidden"
                        >
                            <Menu size={24} />
                        </button>
                    )}
                    <h1 className="text-2xl font-bold text-gray-800">Ollama Chat</h1>
                </div>

                <div className="flex items-center gap-3">
                    {isLoggedIn ? (
                        <>
                            {userEmail && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-md">
                                    <User size={18} className="text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">{userEmail}</span>
                                </div>
                            )}
                            <button
                                onClick={onLogoutClick}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 font-medium"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onLoginClick}
                                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
                            >
                                Login
                            </button>
                            <button
                                onClick={onRegisterClick}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                            >
                                Register
                            </button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default NavBar;
