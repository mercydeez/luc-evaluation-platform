import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import Audit from './routes/Audit'
import Case from './routes/Case'
import Cohort from './routes/Cohort'
import Consistency from './routes/Consistency'
import Overview from './routes/Overview'
import Review from './routes/Review'
import ReviewDetail from './routes/ReviewDetail'
import Student from './routes/Student'
import Submit from './routes/Submit'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <Shell>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Case />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/consistency" element={<Consistency />} />
        <Route path="/review" element={<Review />} />
        <Route path="/review/:submissionId" element={<ReviewDetail />} />
        <Route path="/student" element={<Student />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/cohort" element={<Cohort />} />
        {/* Older shared links pointed the dashboard at the root. */}
        <Route path="/case" element={<Case />} />
        <Route path="*" element={<Case />} />
      </Routes>
    </Shell>
  )
}
