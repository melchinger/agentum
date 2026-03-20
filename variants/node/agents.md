### Node Overlay
- Organize runtime code into domain, application, infrastructure, and interface or delivery layers.
- Keep CLI handlers, HTTP handlers, and queue consumers thin; delegate behavior into application services.
- Centralize configuration parsing and fail fast on invalid environment values.
- Use structured logging and explicit error mapping instead of ad-hoc console output in production paths.
