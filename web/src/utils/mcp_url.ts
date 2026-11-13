import { API_URL } from '@src/config/env'

/**
 * The public MCP endpoint of the server this app talks to. The packaged app and
 * the dev server both point at VITE_API_URL; the web build is served by the API
 * itself, so its own origin is the server.
 */
export function mcpUrl(): string {
  return `${API_URL !== '' ? API_URL : window.location.origin}/mcp`
}

export function claudeCodeCommand(token: string): string {
  return `claude mcp add --transport http notes ${mcpUrl()} --header "Authorization: Bearer ${token}"`
}

/** Stands in for the token in instructions shown without one. Safe to paste into a shell. */
export const TOKEN_PLACEHOLDER: string = 'YOUR_TOKEN'
