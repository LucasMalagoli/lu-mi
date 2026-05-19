import { config } from '../config'

const originalFetch = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const response = await originalFetch(input, init)

  if (response.status === 401) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const isApiCall = url.startsWith(config.API_URL)
    const path = window.location.pathname
    const onAuthPage = path === '/login' || path === '/register'

    if (isApiCall && !onAuthPage) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('username')
      localStorage.removeItem('user_id')
      window.location.href = '/login'
    }
  }

  return response
}
