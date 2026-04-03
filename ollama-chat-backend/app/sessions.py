import asyncio
from typing import Dict, List

#chat sesije

class SessionState:
    def __init__(self):
        self.messages: List[dict] = []
        #set() marks the event as triggered (cancellation requested), clear() resets the event (no cancellation)
        self.cancel_event = asyncio.Event()
        self.generation_id: str | None = None

# In-memory session store
# data is lost when server restarts
sessions: Dict[str, SessionState] = {}
