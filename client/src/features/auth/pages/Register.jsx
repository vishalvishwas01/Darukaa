import { Eye, EyeOff, LoaderCircle, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import useAuth from '../../../hooks/useAuth'
import { normalizeApiError } from '../../../services/api'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Please complete all required fields.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError('Enter a valid email address.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (new TextEncoder().encode(form.password).length > 72) {
      setError('Password must be no more than 72 UTF-8 bytes.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      navigate('/login', { replace: true, state: { message: 'Account created. You can sign in now.' } })
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Start here"
      title="Put good work on the map."
      description="Create your workspace to organize restoration projects and the places they touch."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <label className="field-label" htmlFor="register-name">Full name</label>
        <input id="register-name" className="text-input" name="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={updateField} required />
        <label className="field-label" htmlFor="register-email">Email address</label>
        <input id="register-email" className="text-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={updateField} required />
        <label className="field-label" htmlFor="register-password">Password</label>
        <div className="password-input-wrap">
          <input id="register-password" className="text-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={updateField} required />
          <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <label className="field-label" htmlFor="register-confirm-password">Confirm password</label>
        <div className="password-input-wrap">
          <input id="register-confirm-password" className="text-input" name="confirmPassword" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" value={form.confirmPassword} onChange={updateField} required />
          <button className="password-toggle" type="button" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? 'Hide confirmation' : 'Show confirmation'}>
            {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
