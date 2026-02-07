/**
 * Composable for making API calls to the Admin API
 * Used by demo and www apps to call the centralized API
 */
export function useApi() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  /**
   * Make a fetch request to the Admin API
   */
  async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${apiBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

    const response = await $fetch<T>(url, {
      ...options,
      credentials: 'include', // Include cookies for cross-subdomain auth
    })

    return response
  }

  /**
   * GET request helper
   */
  function get<T>(endpoint: string) {
    return apiFetch<T>(endpoint, { method: 'GET' })
  }

  /**
   * POST request helper
   */
  function post<T>(endpoint: string, body?: unknown) {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  /**
   * PUT request helper
   */
  function put<T>(endpoint: string, body?: unknown) {
    return apiFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  /**
   * DELETE request helper
   */
  function del<T>(endpoint: string) {
    return apiFetch<T>(endpoint, { method: 'DELETE' })
  }

  return {
    apiBase,
    fetch: apiFetch,
    get,
    post,
    put,
    delete: del
  }
}
