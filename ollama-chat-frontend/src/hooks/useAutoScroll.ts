import { useRef, useEffect, useState, type RefObject } from "react";

interface UseAutoScrollResult {
    messagesEndRef: RefObject<HTMLDivElement | null>;
    messagesContainerRef: RefObject<HTMLDivElement | null>;
    resetScroll: () => void;
}

export function useAutoScroll(messages: unknown[]): UseAutoScrollResult {
    const [userHasScrolled, setUserHasScrolled] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        if (!userHasScrolled) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, userHasScrolled]);

    // Detect user scroll
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const isAtBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight < 50;
            setUserHasScrolled(!isAtBottom);
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    const resetScroll = () => setUserHasScrolled(false);

    return {
        messagesEndRef,
        messagesContainerRef,
        resetScroll,
    };
}
