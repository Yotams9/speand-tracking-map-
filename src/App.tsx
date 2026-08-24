import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from '@/components/AppShell'
import { MapHome } from '@/screens/MapHome'
import { ForYou } from '@/screens/ForYou'
import { Capture } from '@/screens/Capture'
import { Inbox } from '@/screens/Inbox'
import { Profile } from '@/screens/Profile'
import { PurchaseDetail } from '@/screens/PurchaseDetail'
import { MerchantDetail } from '@/screens/MerchantDetail'
import { Compare } from '@/screens/Compare'
import { LikelyNeeded } from '@/screens/LikelyNeeded'

/** Navigating to a new screen should land at its top, not mid-scroll. */
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export function App() {
  return (
    <>
      <ScrollReset />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<MapHome />} />
          <Route path="/for-you" element={<ForYou />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/purchase/:id" element={<PurchaseDetail />} />
          <Route path="/merchant/:id" element={<MerchantDetail />} />
          <Route path="/compare/:id" element={<Compare />} />
          <Route path="/needed" element={<LikelyNeeded />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}
