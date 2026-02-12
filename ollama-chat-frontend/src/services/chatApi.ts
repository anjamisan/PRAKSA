const API_BASE = "http://localhost:8000";

export type Message = {
    role: "user" | "assistant";
    content: string;
};

export async function fetchChatMessages(chatId: number, authToken: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch messages");

    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function saveMessage(
    chatId: number,
    role: string,
    content: string,
    authToken: string
): Promise<void> {
    await fetch(`${API_BASE}/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ role, content }),
    });
}

export async function inferChatTitle(prompt: string): Promise<string> {
    try {
        const response = await fetch(`${API_BASE}/title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: prompt }),
        });
        if (!response.ok) throw new Error("Failed to generate title");
        const data = await response.json();
        return data.title || truncatePrompt(prompt);
    } catch (err) {
        console.error("Failed to infer chat title:", err);
        return truncatePrompt(prompt);
    }
}

export async function stopGeneration(sessionId: string): Promise<void> {
    await fetch(`${API_BASE}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
    });
}

export async function sendChatMessage(
    sessionId: string,
    message: string,
    model: string,
    images: File[],
    signal: AbortSignal
): Promise<Response> {
    if (images.length > 0) {
        const formData = new FormData();
        formData.append("session_id", sessionId);
        formData.append("message", message);
        formData.append("model_index", model);
        images.forEach((image) => {
            formData.append("images", image);
        });

        return fetch(`${API_BASE}/chat`, {
            method: "POST",
            body: formData,
            signal,
        });
    }

    return fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session_id: sessionId,
            message,
            model_index: model,
        }),
        signal,
    });
}

function truncatePrompt(prompt: string, maxLength = 50): string {
    console.log("Truncating prompt for title inference:", prompt);
    return prompt.substring(0, maxLength) + (prompt.length > maxLength ? "..." : "");
}
