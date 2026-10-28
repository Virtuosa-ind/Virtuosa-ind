'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function AdminLoginPage () {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMensaje, setErrorMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mostrarContrasena, setMostrarContrasena] = useState(false)

  async function iniciarSesion (evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorMensaje('')
    setCargando(true)

    const supabase = createClient()

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error || !data.user) {
        setErrorMensaje('El correo o la contraseña no son correctos.')
        return
      }

      const { data: administrador, error: errorAdmin } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (errorAdmin) {
        await supabase.auth.signOut()
        setErrorMensaje(
          'No pudimos verificar los permisos. Revisá la configuración e intentá nuevamente.'
        )
        return
      }

      if (!administrador) {
        await supabase.auth.signOut()
        setErrorMensaje(
          'Esta cuenta no está autorizada para administrar la tienda.'
        )
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch {
      setErrorMensaje(
        'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className='login-admin-page'>
      <section className='login-admin-card'>
        <span className='etiqueta-dorada'>VIRTUOSA IND.</span>

        <h1>Panel administrativo</h1>

        <p>
          Ingresá con tu cuenta autorizada para administrar las prendas de la
          tienda.
        </p>

        <form onSubmit={iniciarSesion} className='login-admin-form'>
          <label htmlFor='admin-email'>Correo electrónico</label>

          <input
            id='admin-email'
            type='email'
            autoComplete='username'
            value={email}
            onChange={evento => setEmail(evento.target.value)}
            placeholder='Ingresá tu correo'
            required
          />

          <label htmlFor='admin-password'>Contraseña</label>

          <div className='login-admin-password-field'>
            <input
              id='admin-password'
              type={mostrarContrasena ? 'text' : 'password'}
              autoComplete='current-password'
              value={password}
              onChange={evento => setPassword(evento.target.value)}
              placeholder='Ingresá tu contraseña'
              required
            />

            <button
              type='button'
              className='login-admin-password-toggle'
              onClick={() => setMostrarContrasena(actual => !actual)}
              aria-label={
                mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              title={
                mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              aria-pressed={mostrarContrasena}
            >
              {mostrarContrasena ? '🐵' : '🙈'}
            </button>
          </div>
          {errorMensaje && (
            <p className='login-admin-error' role='alert'>
              {errorMensaje}
            </p>
          )}

          <button type='submit' disabled={cargando}>
            {cargando ? 'Verificando acceso...' : 'INICIAR SESIÓN'}
          </button>
        </form>

        <a className='login-admin-volver' href='/'>
          Volver a la tienda
        </a>
      </section>
    </main>
  )
}
