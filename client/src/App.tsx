import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { queryClient } from '@/lib/queryClient'
import { setNavigateToLogin } from '@/lib/axios'

// Register the router-aware redirect so the 401 interceptor uses SPA navigation
setNavigateToLogin(() => void router.navigate({ to: '/login' }))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
