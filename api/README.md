<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## Using with Claude

The API serves an MCP endpoint at `<APP_URL>/mcp` (HTTP transport). Claude can search,
read and write your Cloud notes through it, with note bodies as markdown. It **cannot delete**
anything: there are no delete, trash or restore tools, and access tokens cannot reach those
routes. Notes in the Trash and notes stored "On This Device" are not visible to it.

### 1. Create an access token

In the web app, open **Settings → Access tokens**, choose a name, the scopes and an expiry,
and copy the token. It starts with `notes_pat_` and is shown **once**.

- `notes:read`: search, list and read notes, folders and tags.
- `notes:write`: also create and edit notes, folders and tags. It includes `notes:read`.

The same can be done through the API while signed in (`expires_in_days` is 30, 90, 365 or
`null` for no expiry):

```sh
curl -X POST "$APP_URL/api/v1/me/access-tokens" \
  -H "Authorization: Bearer <your sign-in token>" -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"name":"Claude Code","abilities":["notes:read","notes:write"],"expires_in_days":90}'
```

You can have up to 20 active tokens. Expired tokens stop working at once. The scheduler
removes them daily (`php artisan notes:prune-pats`).

### 2. Claude Code

```sh
claude mcp add --transport http notes <APP_URL>/mcp --header "Authorization: Bearer <token>"
```

Or share it with a project in `.mcp.json`, keeping the token out of the file:

```json
{
  "mcpServers": {
    "notes": {
      "type": "http",
      "url": "https://notes.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${NOTES_TOKEN}"
      }
    }
  }
}
```

Then `export NOTES_TOKEN=notes_pat_…` before starting `claude`.

### 3. Claude web, desktop and mobile

Anthropic's servers make the calls, so the API must be **public over HTTPS**. `localhost`
and private addresses won't work. If a firewall sits in front of it, allowlist Anthropic's
published IP ranges.

1. On claude.ai, go to **Customize → Connectors → Add custom connector**.
2. Enter the URL `https://<your-domain>/mcp`.
3. Choose **no sign-in** (no OAuth), and add the request header
   `Authorization: Bearer <token>`.

The connector then appears in Claude Desktop and in the mobile apps too.

### Revoking a token

Revoke it under **Settings → Access tokens**, or with
`DELETE /api/v1/me/access-tokens/{id}`. It stops working immediately. Remove it from Claude
too (`claude mcp remove notes`, or delete the connector).

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
