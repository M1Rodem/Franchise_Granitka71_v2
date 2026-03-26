import { Outlet } from 'react-router-dom'
import { RouterEvents } from './router-events'

export function RootLayout() {
  return (
    <>
      <RouterEvents />
      <Outlet />
    </>
  )
}