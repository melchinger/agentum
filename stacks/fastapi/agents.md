### Stack Module: FastAPI
- Treat FastAPI as a delivery adapter; keep request parsing, response shaping, and route wiring out of core domain logic.
- Use Pydantic models or typed DTOs at request boundaries and map them into application-layer inputs explicitly.
- Keep route modules small, prefer dependency-injected services, and keep startup wiring centralized.
