import { Eye, EyeOff, LoaderCircle, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import useAuth from '../../../hooks/useAuth'
import { normalizeApiError } from '../../../services/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password to continue.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await login({ email: form.email.trim(), password: form.password })
      const destination = location.state?.from?.pathname || '/dashboard'
      navigate(destination, { replace: true })
    } catch (requestError) {
      const message = normalizeApiError(requestError)
      setError(message === 'Something went wrong. Please try again.' ? 'Invalid email or password.' : message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Return to the field."
      description="Sign in to continue shaping healthier landscapes with your team."
      footer={<>New to Darukaa.Earth? <Link to="/register">Create an account</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <label className="field-label" htmlFor="login-email">Email address</label>
        <input id="login-email" className="text-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={updateField} required />
        <label className="field-label" htmlFor="login-password">Password</label>
        <div className="password-input-wrap">
          <input id="login-password" className="text-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={updateField} required />
          <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
