### PHP Overlay
- Follow PSR conventions and keep framework glue, controllers, and templates thin.
- Put domain behavior into services, actions, or use-case classes instead of Blade, Twig, or raw PHP views.
- Validate request data before it reaches domain logic and map infrastructure exceptions to safe user-facing responses.
- Avoid static global helpers for business logic when dependency injection or explicit services fit better.
