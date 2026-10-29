'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HexColorInput, HexColorPicker } from 'react-colorful'

type SelectorColorProps = {
  color: string
  onChange: (codigo: string) => void
  label: string
  compacto?: boolean
}

type FormatoCodigo = 'HEX' | 'RGB' | 'HSL'

function normalizarHex (valor: string): string | null {
  let hex = valor.trim().replace(/^#/, '')

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split('')
      .map(caracter => caracter + caracter)
      .join('')
  }

  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null
}

function hexARgb (hex: string): [number, number, number] {
  const normalizado = normalizarHex(hex) ?? '#C5A052'
  const valor = normalizado.slice(1)

  return [
    parseInt(valor.slice(0, 2), 16),
    parseInt(valor.slice(2, 4), 16),
    parseInt(valor.slice(4, 6), 16)
  ]
}

function rgbAHex (r: number, g: number, b: number): string {
  const convertir = (numero: number) =>
    Math.round(numero).toString(16).padStart(2, '0')

  return `#${convertir(r)}${convertir(g)}${convertir(b)}`.toUpperCase()
}

function hexAHsl (hex: string): [number, number, number] {
  const [rOriginal, gOriginal, bOriginal] = hexARgb(hex)

  const r = rOriginal / 255
  const g = gOriginal / 255
  const b = bOriginal / 255

  const maximo = Math.max(r, g, b)
  const minimo = Math.min(r, g, b)

  let h = 0
  let s = 0
  const l = (maximo + minimo) / 2

  if (maximo !== minimo) {
    const diferencia = maximo - minimo

    s =
      l > 0.5
        ? diferencia / (2 - maximo - minimo)
        : diferencia / (maximo + minimo)

    if (maximo === r) {
      h = (g - b) / diferencia + (g < b ? 6 : 0)
    } else if (maximo === g) {
      h = (b - r) / diferencia + 2
    } else {
      h = (r - g) / diferencia + 4
    }

    h *= 60
  }

  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

function hslAHex (h: number, s: number, l: number): string {
  const saturacion = s / 100
  const luminosidad = l / 100
  const tono = ((h % 360) + 360) % 360

  const c = (1 - Math.abs(2 * luminosidad - 1)) * saturacion

  const x = c * (1 - Math.abs(((tono / 60) % 2) - 1))
  const m = luminosidad - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (tono < 60) {
    r = c
    g = x
  } else if (tono < 120) {
    r = x
    g = c
  } else if (tono < 180) {
    g = c
    b = x
  } else if (tono < 240) {
    g = x
    b = c
  } else if (tono < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return rgbAHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

function mostrarCodigo (hex: string, formato: FormatoCodigo): string {
  const normalizado = normalizarHex(hex) ?? '#C5A052'

  if (formato === 'HEX') {
    return normalizado
  }

  if (formato === 'RGB') {
    const [r, g, b] = hexARgb(normalizado)
    return `rgb(${r}, ${g}, ${b})`
  }

  const [h, s, l] = hexAHsl(normalizado)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function convertirCodigo (texto: string, formato: FormatoCodigo): string | null {
  if (formato === 'HEX') {
    return normalizarHex(texto)
  }

  const numeros = texto.match(/-?\d+(?:\.\d+)?/g)?.map(Number)

  if (
    !numeros ||
    numeros.length !== 3 ||
    numeros.some(n => !Number.isFinite(n))
  ) {
    return null
  }

  const [a, b, c] = numeros

  if (formato === 'RGB') {
    if (a < 0 || a > 255 || b < 0 || b > 255 || c < 0 || c > 255) {
      return null
    }

    return rgbAHex(a, b, c)
  }

  if (a < 0 || a > 360 || b < 0 || b > 100 || c < 0 || c > 100) {
    return null
  }

  return hslAHex(a, b, c)
}

export default function SelectorColor ({
  color,
  onChange,
  label,
  compacto = false
}: SelectorColorProps) {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)
  const [formato, setFormato] = useState<FormatoCodigo>('HEX')
  const [codigoEditado, setCodigoEditado] = useState<string | null>(null)
  const [errorCodigo, setErrorCodigo] = useState('')

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    setCodigoEditado(null)
    setErrorCodigo('')
  }, [color])

  useEffect(() => {
    if (!abierto) return

    function cerrarConEscape (event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAbierto(false)
      }
    }

    document.addEventListener('keydown', cerrarConEscape)

    return () => {
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [abierto])

  function confirmarCodigo (): boolean {
    if (codigoEditado === null) return true

    const convertido = convertirCodigo(codigoEditado, formato)

    if (!convertido) {
      setErrorCodigo(
        formato === 'HEX'
          ? 'Ingresá un HEX válido, por ejemplo #C5A052.'
          : formato === 'RGB'
          ? 'Usá RGB entre 0 y 255, por ejemplo rgb(197, 160, 82).'
          : 'Usá HSL con tono 0–360 y porcentajes 0–100.'
      )

      return false
    }

    setErrorCodigo('')
    setCodigoEditado(null)
    onChange(convertido)

    return true
  }

  return (
    <div className='selector-color'>
      <button
        type='button'
        className={`selector-color-boton ${
          compacto ? 'selector-color-boton-compacto' : ''
        }`}
        onClick={() => setAbierto(true)}
        aria-label={`${label}: ${color}`}
        aria-expanded={abierto}
        title={label}
      >
        <span
          className='selector-color-muestra'
          style={{ backgroundColor: color }}
        />

        {!compacto && (
          <>
            <span className='selector-color-texto'>{label}</span>
            <span className='selector-color-hex'>{color.toUpperCase()}</span>
          </>
        )}
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div
            className='vi-color-overlay'
            onMouseDown={event => {
              if (event.target === event.currentTarget) {
                setAbierto(false)
              }
            }}
            onTouchStart={event => {
              if (event.target === event.currentTarget) {
                setAbierto(false)
              }
            }}
          >
            <section
              className='vi-color-dialog'
              role='dialog'
              aria-modal='true'
              aria-label={label}
            >
              <header className='vi-color-dialog-header'>
                <div>
                  <span className='vi-color-eyebrow'>VIRTUOSA IND</span>
                  <h3>Elegí un color</h3>
                  <p>{label}</p>
                </div>

                <button
                  type='button'
                  className='vi-color-cerrar'
                  onClick={() => setAbierto(false)}
                  aria-label='Cerrar selector'
                >
                  ×
                </button>
              </header>

              <div className='vi-color-vista'>
                <span
                  className='vi-color-circulo'
                  style={{ backgroundColor: color }}
                />

                <div>
                  <span>Color seleccionado</span>
                  <strong>{color.toUpperCase()}</strong>
                </div>
              </div>

              <div className='vi-color-picker-contenedor'>
                <HexColorPicker
                  color={color}
                  onChange={onChange}
                  className='vi-color-picker'
                />
              </div>

              <label className='vi-color-formato'>
                <span>Formato del código</span>

                <select
                  value={formato}
                  onChange={event => {
                    setFormato(event.target.value as FormatoCodigo)
                    setCodigoEditado(null)
                    setErrorCodigo('')
                  }}
                >
                  <option value='HEX'>HEX — hexadecimal</option>
                  <option value='RGB'>RGB — rojo, verde, azul</option>
                  <option value='HSL'>
                    HSL — tono, saturación, luminosidad
                  </option>
                </select>
              </label>

              <label className='vi-color-codigo'>
                <span>Código del color</span>

                {formato === 'HEX' ? (
                  <HexColorInput
                    color={color}
                    onChange={onChange}
                    prefixed
                    alpha={false}
                    placeholder='#C5A052'
                    aria-label='Código hexadecimal del color'
                  />
                ) : (
                  <input
                    type='text'
                    autoComplete='off'
                    spellCheck={false}
                    value={codigoEditado ?? mostrarCodigo(color, formato)}
                    onChange={event => {
                      setCodigoEditado(event.target.value)
                      setErrorCodigo('')
                    }}
                    onBlur={confirmarCodigo}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        confirmarCodigo()
                      }
                    }}
                    placeholder={
                      formato === 'RGB'
                        ? 'rgb(197, 160, 82)'
                        : 'hsl(41, 49%, 55%)'
                    }
                    aria-label={`Código ${formato} del color`}
                  />
                )}
              </label>

              {errorCodigo && (
                <p className='vi-color-error' role='alert'>
                  {errorCodigo}
                </p>
              )}

              <button
                type='button'
                className='vi-color-confirmar'
                onClick={() => {
                  if (confirmarCodigo()) {
                    setAbierto(false)
                  }
                }}
              >
                Listo
              </button>
            </section>
          </div>,
          document.body
        )}
    </div>
  )
}
