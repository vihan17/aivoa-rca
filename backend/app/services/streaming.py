"""Server-Sent Events plumbing for long-running LangGraph runs."""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable

Runner = Callable[[Callable[[dict], Awaitable[None]]], Awaitable[dict]]

# Model calls can leave the stream quiet for over a minute; proxies drop idle
# connections, so send an SSE comment well inside that window.
HEARTBEAT_SECONDS = 10.0

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


async def stream_run(runner: Runner) -> AsyncIterator[str]:
    """Run a graph and stream stage events followed by a single result event."""
    queue: asyncio.Queue = asyncio.Queue()

    async def emit(payload: dict) -> None:
        await queue.put(("stage", payload))

    async def execute() -> None:
        try:
            result = await runner(emit)
            await queue.put(("result", result))
        except Exception as exc:  # surfaced to the UI as a retryable error
            await queue.put(("error", {"message": str(exc)[:600]}))
        finally:
            await queue.put(None)

    task = asyncio.create_task(execute())
    try:
        yield _sse("open", {"ok": True})
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
                continue
            if item is None:
                break
            yield _sse(item[0], item[1])
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
