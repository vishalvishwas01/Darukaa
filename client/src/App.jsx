import { useEffect, useState } from 'react'
import api from './services/api'

function App() {
  const [status, setStatus] = useState('Checking backend...')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/health')
      .then((response) => {
        setStatus(response.data.status)
      })
      .catch(() => {
        setError('Unable to connect to backend')
      })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="rounded-xl bg-white p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold text-slate-800">
          Darukaa.Earth
        </h1>

        <p className="mt-3 text-slate-600">
          Backend connection status:
        </p>

        <p className="mt-2 font-semibold">
          {error || status}
        </p>
      </div>
    </div>
  )
}

export default App