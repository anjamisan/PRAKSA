import asyncio
from typing import Dict, List

class SessionState:
    def __init__(self):
        self.messages: List[dict] = []
        self.cancel_event = asyncio.Event()

# In-memory session store
sessions: Dict[str, SessionState] = {}
