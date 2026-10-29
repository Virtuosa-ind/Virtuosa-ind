'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import './admin.css'
import { createClient } from '@/lib/supabase/client'
import { optimizarFotografia } from '@/lib/optimizar-fotografia'
import SelectorColor from './SelectorColor'

import {
  categorias,
  type EstadoProducto,
  type Producto,
  type VarianteProducto
} from '@/lib/productos'

import {
  obtenerProductosSupabase,
  guardarProductoSupabase,
  actualizarEstadoSupabase,
  eliminarProductoSupabase
} from '@/lib/supabase/productos'

type Seccion = 'inicio' | 'productos' | 'agregar'

type VarianteFormulario = {
  id: string
  color: string
  codigoColor: string
  talle: string
  stock: string
}

type ColorFormulario = {
  nombre: string
  codigo: string
}
const coloresPredeterminados: ColorFormulario[] = [
  { nombre: 'Negro', codigo: '#171417' },
  { nombre: 'Blanco', codigo: '#ffffff' },
  { nombre: 'Crudo', codigo: '#eee5d5' },
  { nombre: 'Beige', codigo: '#d9c5a0' },
  { nombre: 'Gris', codigo: '#999999' },
  { nombre: 'Marrón', codigo: '#76513d' },
  { nombre: 'Rosa', codigo: '#f4dce5' },
  { nombre: 'Rosa viejo', codigo: '#c78f9d' },
  { nombre: 'Bordó', codigo: '#702b3b' },
  { nombre: 'Rojo', codigo: '#b53636' },
  { nombre: 'Naranja', codigo: '#dc783b' },
  { nombre: 'Amarillo', codigo: '#efd36c' },
  { nombre: 'Verde', codigo: '#397451' },
  { nombre: 'Celeste', codigo: '#9bcbea' },
  { nombre: 'Azul', codigo: '#244a78' },
  { nombre: 'Azul petróleo', codigo: '#24545a' },
  { nombre: 'Lila', codigo: '#c5a4dc' },
  { nombre: 'Violeta', codigo: '#7650a8' }
]

const precioValido = (valor: string): boolean => {
  const numero = Number(valor)
  return valor.trim() !== '' && Number.isFinite(numero) && numero >= 0
}

const formatoPrecio = (precio: number): string =>
  precio.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  })

const textoEstado = (estado: EstadoProducto): string => {
  if (estado === 'publicado') return 'Publicado'
  if (estado === 'oculto') return 'Oculto'
  return 'Borrador'
}

function obtenerCodigoColor (color: string): string {
  const colores: Record<string, string> = {
    negro: '#171417',
    blanco: '#ffffff',
    rosa: '#f4dce5',
    beige: '#d9c5a0',
    azul: '#244a78',
    celeste: '#9bcbea',
    marrón: '#76513d',
    gris: '#999999',
    rojo: '#b53636',
    verde: '#397451'
  }

  return colores[color.trim().toLocaleLowerCase()] ?? '#c5a052'
}

function separarTalles (valor: string): string[] {
  return valor
    .split(/[,;\n]+/)
    .map(talle => talle.trim())
    .filter(Boolean)
}

export default function AdminPage () {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  const [seccionActiva, setSeccionActiva] = useState<Seccion>('productos')
  const [menuAbierto, setMenuAbierto] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroEstado, setFiltroEstado] = useState('Todos')

  const [productoEditando, setProductoEditando] = useState<Producto | null>(
    null
  )

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<string>(categorias[0])
  const [precio, setPrecio] = useState('')
  const [estadoFormulario, setEstadoFormulario] =
    useState<EstadoProducto>('borrador')

  const [variantesFormulario, setVariantesFormulario] = useState<
    VarianteFormulario[]
  >([])

  const [coloresFormulario, setColoresFormulario] = useState<ColorFormulario[]>(
    []
  )

  const [tallesFormulario, setTallesFormulario] = useState<string[]>([])

  const [nuevoColor, setNuevoColor] = useState('')
  const [nuevoCodigoColor, setNuevoCodigoColor] = useState('#c5a052')
  const [nuevoTalle, setNuevoTalle] = useState('')

  const [colorCombinacion, setColorCombinacion] = useState('')
  const [tallesCombinacion, setTallesCombinacion] = useState<string[]>([])

  const [fotosGuardadas, setFotosGuardadas] = useState<string[]>([])
  const [archivosFotos, setArchivosFotos] = useState<File[]>([])
  const [previsualizaciones, setPrevisualizaciones] = useState<string[]>([])

  const [guardando, setGuardando] = useState(false)
  const [optimizandoFotos, setOptimizandoFotos] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [productoEnProceso, setProductoEnProceso] = useState<string | null>(
    null
  )
  const [mensaje, setMensaje] = useState('')
  async function cerrarSesion () {
    if (cerrandoSesion) return

    setCerrandoSesion(true)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      window.location.replace('/admin/login')
    } catch (error) {
      console.error('Error cerrando la sesión:', error)

      setMensaje(
        'No se pudo cerrar la sesión. Revisá tu conexión e intentá nuevamente.'
      )

      setCerrandoSesion(false)
    }
  }

  async function cargarProductos () {
    setCargando(true)

    try {
      const lista = await obtenerProductosSupabase()
      setProductos(lista)
    } catch (error) {
      console.error('Error cargando los productos:', error)
      setMensaje('No se pudieron cargar las prendas. Revisá la conexión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarProductos()
  }, [])

  useEffect(() => {
    const urls = archivosFotos.map(archivo => URL.createObjectURL(archivo))
    setPrevisualizaciones(urls)

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [archivosFotos])

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase()

    return productos.filter(producto => {
      const coincideTexto =
        !texto ||
        producto.nombre.toLocaleLowerCase().includes(texto) ||
        producto.descripcion.toLocaleLowerCase().includes(texto) ||
        producto.categoria.toLocaleLowerCase().includes(texto)

      const coincideCategoria =
        filtroCategoria === 'Todas' || producto.categoria === filtroCategoria

      const coincideEstado =
        filtroEstado === 'Todos' || producto.estado === filtroEstado

      return coincideTexto && coincideCategoria && coincideEstado
    })
  }, [productos, busqueda, filtroCategoria, filtroEstado])

  const publicados = productos.filter(
    producto => producto.estado === 'publicado'
  ).length

  const borradores = productos.filter(
    producto => producto.estado === 'borrador'
  ).length

  const ocultos = productos.filter(
    producto => producto.estado === 'oculto'
  ).length

  function limpiarFormulario () {
    setProductoEditando(null)
    setNombre('')
    setDescripcion('')
    setCategoria(categorias[0])
    setPrecio('')
    setEstadoFormulario('borrador')

    setVariantesFormulario([])
    setColoresFormulario([])
    setTallesFormulario([])

    setNuevoColor('')
    setNuevoCodigoColor('#c5a052')
    setNuevoTalle('')
    setColorCombinacion('')
    setTallesCombinacion([])

    setFotosGuardadas([])
    setArchivosFotos([])
    setMensaje('')
  }

  function abrirFormularioNuevo () {
    limpiarFormulario()
    setSeccionActiva('agregar')
    setMenuAbierto(false)
  }

  function editarProducto (producto: Producto) {
    setProductoEditando(producto)
    setNombre(producto.nombre)
    setDescripcion(producto.descripcion)
    setCategoria(producto.categoria)
    setPrecio(String(producto.precio))
    setEstadoFormulario(producto.estado)
    setFotosGuardadas(producto.fotos ?? [])
    setArchivosFotos([])

    const variantesExistentes = producto.variantes ?? []
    const coloresUnicos = new Map<string, ColorFormulario>()
    const tallesUnicos = new Map<string, string>()

    variantesExistentes.forEach(variante => {
      const nombreColor = variante.color.trim()
      const claveColor = nombreColor.toLocaleLowerCase()

      if (nombreColor && !coloresUnicos.has(claveColor)) {
        coloresUnicos.set(claveColor, {
          nombre: nombreColor,
          codigo: variante.colorCodigo ?? obtenerCodigoColor(nombreColor)
        })
      }

      // Permite recuperar talles individuales de registros antiguos agrupados.
      separarTalles(variante.talle).forEach(talle => {
        const claveTalle = talle.toLocaleLowerCase()

        if (!tallesUnicos.has(claveTalle)) {
          tallesUnicos.set(claveTalle, talle)
        }
      })
    })

    setColoresFormulario(Array.from(coloresUnicos.values()))
    setTallesFormulario(Array.from(tallesUnicos.values()))

    // Se conserva cada variante existente y su stock original.
    setVariantesFormulario(
      variantesExistentes.map(variante => ({
        id: variante.id,
        color: variante.color,
        codigoColor: variante.colorCodigo ?? obtenerCodigoColor(variante.color),
        talle: variante.talle,
        stock: variante.stock === null ? '' : String(variante.stock)
      }))
    )

    setNuevoColor('')
    setNuevoCodigoColor('#c5a052')
    setNuevoTalle('')
    setColorCombinacion('')
    setTallesCombinacion([])

    const hayTallesAgrupados = variantesExistentes.some(variante =>
      /[,;\n]/.test(variante.talle)
    )

    setMensaje(
      hayTallesAgrupados
        ? 'Esta prenda tiene variantes antiguas con talles agrupados. Creá las combinaciones individuales, asigná sus cantidades y verificá el stock antes de quitar la variante agrupada.'
        : ''
    )

    setSeccionActiva('agregar')
    setMenuAbierto(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function seleccionarColorPredeterminado (color: ColorFormulario) {
    const existente = coloresFormulario.find(
      item =>
        item.nombre.toLocaleLowerCase() === color.nombre.toLocaleLowerCase()
    )

    if (existente) {
      setColorCombinacion(existente.nombre)
      setMensaje(`${existente.nombre} ya está agregado y quedó seleccionado.`)
      return
    }

    setColoresFormulario(actuales => [...actuales, { ...color }])
    setColorCombinacion(color.nombre)
    setMensaje(`${color.nombre} agregado. Ahora podés elegir varios talles.`)
  }
  function agregarColorFormulario () {
    const nombreColor = nuevoColor.trim()

    if (!nombreColor) {
      setMensaje('Escribí el nombre del color.')
      return
    }

    const existe = coloresFormulario.some(
      color =>
        color.nombre.toLocaleLowerCase() === nombreColor.toLocaleLowerCase()
    )

    if (existe) {
      setMensaje('Ese color ya está agregado.')
      return
    }

    setColoresFormulario(actuales => [
      ...actuales,
      { nombre: nombreColor, codigo: nuevoCodigoColor }
    ])

    setColorCombinacion(nombreColor)
    setNuevoColor('')
    setMensaje('')
  }

  function actualizarColorCodigo (nombreColor: string, codigo: string) {
    setColoresFormulario(actuales =>
      actuales.map(color =>
        color.nombre === nombreColor ? { ...color, codigo } : color
      )
    )

    setVariantesFormulario(actuales =>
      actuales.map(variante =>
        variante.color.toLocaleLowerCase() === nombreColor.toLocaleLowerCase()
          ? { ...variante, codigoColor: codigo }
          : variante
      )
    )
  }

  function quitarColorFormulario (nombreColor: string) {
    const tieneVariantes = variantesFormulario.some(
      variante =>
        variante.color.toLocaleLowerCase() === nombreColor.toLocaleLowerCase()
    )

    if (
      tieneVariantes &&
      !window.confirm(
        `¿Quitar el color "${nombreColor}" y todas sus combinaciones asociadas?`
      )
    ) {
      return
    }

    setColoresFormulario(actuales =>
      actuales.filter(
        color =>
          color.nombre.toLocaleLowerCase() !== nombreColor.toLocaleLowerCase()
      )
    )

    setVariantesFormulario(actuales =>
      actuales.filter(
        variante =>
          variante.color.toLocaleLowerCase() !== nombreColor.toLocaleLowerCase()
      )
    )

    setColorCombinacion(actual =>
      actual.toLocaleLowerCase() === nombreColor.toLocaleLowerCase()
        ? ''
        : actual
    )

    setMensaje('')
  }

  function agregarTalleFormulario () {
    const nuevos = separarTalles(nuevoTalle)

    if (nuevos.length === 0) {
      setMensaje('Escribí al menos un talle.')
      return
    }

    const existentes = new Set(
      tallesFormulario.map(talle => talle.toLocaleLowerCase())
    )

    const agregados: string[] = []

    for (const talle of nuevos) {
      const clave = talle.toLocaleLowerCase()

      if (!existentes.has(clave)) {
        existentes.add(clave)
        agregados.push(talle)
      }
    }

    if (agregados.length === 0) {
      setMensaje('Esos talles ya están agregados.')
      return
    }

    setTallesFormulario(actuales => [...actuales, ...agregados])

    setNuevoTalle('')
    setMensaje('')
  }

  function quitarTalleFormulario (talle: string) {
    const tieneVariantes = variantesFormulario.some(variante =>
      separarTalles(variante.talle).some(
        talleVariante =>
          talleVariante.toLocaleLowerCase() === talle.toLocaleLowerCase()
      )
    )

    if (
      tieneVariantes &&
      !window.confirm(
        `¿Quitar el talle "${talle}" y todas sus combinaciones asociadas?`
      )
    ) {
      return
    }

    setTallesFormulario(actuales =>
      actuales.filter(
        item => item.toLocaleLowerCase() !== talle.toLocaleLowerCase()
      )
    )

    setVariantesFormulario(actuales =>
      actuales.filter(
        variante =>
          !separarTalles(variante.talle).some(
            talleVariante =>
              talleVariante.toLocaleLowerCase() === talle.toLocaleLowerCase()
          )
      )
    )

    setTallesCombinacion(actuales =>
      actuales.filter(
        item => item.toLocaleLowerCase() !== talle.toLocaleLowerCase()
      )
    )

    setMensaje('')
  }

  function agregarCombinacion () {
    const color = coloresFormulario.find(
      item => item.nombre === colorCombinacion
    )

    if (!color) {
      setMensaje('Elegí un color.')
      return
    }

    if (tallesCombinacion.length === 0) {
      setMensaje('Seleccioná uno o varios talles.')
      return
    }

    const tallesNuevos = tallesCombinacion.filter(
      talle =>
        !variantesFormulario.some(
          variante =>
            variante.color.toLocaleLowerCase() ===
              color.nombre.toLocaleLowerCase() &&
            variante.talle.toLocaleLowerCase() === talle.toLocaleLowerCase()
        )
    )

    if (tallesNuevos.length === 0) {
      setMensaje('Las combinaciones seleccionadas ya están agregadas.')
      return
    }

    const nuevasVariantes: VarianteFormulario[] = tallesNuevos.map(talle => ({
      id: crypto.randomUUID(),
      color: color.nombre,
      codigoColor: color.codigo,
      talle,
      stock: ''
    }))

    setVariantesFormulario(actuales => [...actuales, ...nuevasVariantes])
    setTallesCombinacion([])

    setMensaje(
      `Se agregaron ${nuevasVariantes.length} combinaciones para ${color.nombre}.`
    )
  }

  function actualizarVariante (
    id: string,
    campo: keyof Omit<VarianteFormulario, 'id'>,
    valor: string
  ) {
    setVariantesFormulario(actuales =>
      actuales.map(variante =>
        variante.id === id ? { ...variante, [campo]: valor } : variante
      )
    )
  }

  function quitarVariante (id: string) {
    setVariantesFormulario(actuales =>
      actuales.filter(variante => variante.id !== id)
    )
  }

  async function seleccionarFotos (event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const nuevasFotos = Array.from(input.files ?? [])

    // Permite volver a seleccionar la misma fotografía.
    input.value = ''

    if (nuevasFotos.length === 0) return

    setOptimizandoFotos(true)
    setMensaje('Optimizando fotografías…')

    try {
      const fotosOptimizadas = await Promise.all(
        nuevasFotos.map(optimizarFotografia)
      )

      setArchivosFotos(actuales => [...actuales, ...fotosOptimizadas])

      const pesoOriginal = nuevasFotos.reduce(
        (total, foto) => total + foto.size,
        0
      )

      const pesoFinal = fotosOptimizadas.reduce(
        (total, foto) => total + foto.size,
        0
      )

      const porcentajeReducido =
        pesoOriginal > 0
          ? Math.max(
              0,
              Math.round(((pesoOriginal - pesoFinal) / pesoOriginal) * 100)
            )
          : 0

      if (porcentajeReducido > 0) {
        setMensaje(
          `Fotografías listas. Se redujo el peso un ${porcentajeReducido} %.`
        )
      } else {
        setMensaje('Fotografías listas para guardar.')
      }
    } catch (error) {
      console.error('Error procesando las fotografías:', error)

      setMensaje('No se pudieron procesar las fotografías. Intentá nuevamente.')
    } finally {
      setOptimizandoFotos(false)
    }
  }
  function quitarFotoNueva (indice: number) {
    setArchivosFotos(actuales => actuales.filter((_, i) => i !== indice))
  }

  function quitarFotoGuardada (url: string) {
    setFotosGuardadas(actuales => actuales.filter(foto => foto !== url))
  }
  async function guardarFormulario (estadoSolicitado: EstadoProducto) {
    setMensaje('')

    if (!nombre.trim()) {
      setMensaje('Escribí el nombre de la prenda.')
      return
    }

    if (!precioValido(precio)) {
      setMensaje('Ingresá un precio válido, igual o mayor que cero.')
      return
    }

    const variantes: VarianteProducto[] = variantesFormulario
      .filter(variante => variante.color.trim() && variante.talle.trim())
      .map(variante => {
        const stockTexto = variante.stock.trim()
        const stockNumero = stockTexto === '' ? null : Number(stockTexto)

        return {
          id: variante.id,
          color: variante.color.trim(),
          colorCodigo: variante.codigoColor,
          talle: variante.talle.trim(),
          stock:
            stockNumero === null
              ? null
              : Number.isFinite(stockNumero) && stockNumero >= 0
              ? Math.floor(stockNumero)
              : 0
        }
      })

    const colores = coloresFormulario

    const ahora = new Date().toISOString()

    const producto: Producto = {
      id: productoEditando?.id ?? crypto.randomUUID(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      categoria,
      precio: Number(precio),
      fotos: fotosGuardadas,
      variantes,
      estado: estadoSolicitado,
      creadoEn: productoEditando?.creadoEn ?? ahora,
      actualizadoEn: ahora
    }

    setGuardando(true)

    try {
      await guardarProductoSupabase(producto, archivosFotos, colores)
      await cargarProductos()

      limpiarFormulario()
      setSeccionActiva('productos')

      setMensaje(
        estadoSolicitado === 'publicado'
          ? 'La prenda se guardó y quedó publicada.'
          : estadoSolicitado === 'oculto'
          ? 'La prenda se guardó como oculta.'
          : 'La prenda se guardó como borrador.'
      )
    } catch (error) {
      console.error('Error guardando la prenda:', error)

      setMensaje(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la prenda. Revisá la conexión e intentá nuevamente.'
      )
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstadoProducto (
    producto: Producto,
    nuevoEstado: EstadoProducto
  ) {
    setMensaje('')
    setProductoEnProceso(producto.id)

    try {
      await actualizarEstadoSupabase(producto.id, nuevoEstado)
      await cargarProductos()

      setMensaje(
        `“${producto.nombre}” ahora está en estado: ${textoEstado(
          nuevoEstado
        ).toLocaleLowerCase()}.`
      )
    } catch (error) {
      console.error('Error cambiando el estado:', error)
      setMensaje('No se pudo actualizar el estado de la prenda.')
    } finally {
      setProductoEnProceso(null)
    }
  }

  async function eliminarPrenda (producto: Producto) {
    const confirmar = window.confirm(
      `¿Querés eliminar definitivamente “${producto.nombre}”? \n\nSe eliminará de la tienda y del catálogo administrativo. Esta acción no se puede deshacer.`
    )

    if (!confirmar) return

    setMensaje('')
    setProductoEnProceso(producto.id)

    try {
      await eliminarProductoSupabase(producto.id)
      await cargarProductos()

      if (productoEditando?.id === producto.id) {
        limpiarFormulario()
        setSeccionActiva('productos')
      }

      setMensaje(`La prenda “${producto.nombre}” fue eliminada.`)
    } catch (error) {
      console.error('Error eliminando la prenda:', error)
      setMensaje(
        'No se pudo eliminar la prenda. Revisá la conexión e intentá nuevamente.'
      )
    } finally {
      setProductoEnProceso(null)
    }
  }

  return (
    <main className='admin'>
      <aside
        className={`admin-sidebar ${
          menuAbierto ? 'admin-sidebar-abierto' : ''
        }`}
      >
        <div className='admin-marca'>
          <span>V.I</span>
          <p>VIRTUOSA IND</p>
          <small>Panel administrativo</small>
        </div>

        <nav className='admin-navegacion'>
          <button
            type='button'
            className={seccionActiva === 'inicio' ? 'activo' : ''}
            onClick={() => {
              setSeccionActiva('inicio')
              setMenuAbierto(false)
            }}
          >
            Inicio
          </button>

          <button
            type='button'
            className={seccionActiva === 'productos' ? 'activo' : ''}
            onClick={() => {
              setSeccionActiva('productos')
              setMenuAbierto(false)
              void cargarProductos()
            }}
          >
            Productos
          </button>

          <button
            type='button'
            className={seccionActiva === 'agregar' ? 'activo' : ''}
            onClick={abrirFormularioNuevo}
          >
            + Agregar prenda
          </button>
        </nav>

        <div className='admin-sidebar-pie'>
          <a href='/' target='_blank' rel='noreferrer'>
            Ver tienda ↗
          </a>
          <small>Vestida de fuerza y dignidad</small>
        </div>
      </aside>

      {menuAbierto && (
        <button
          type='button'
          className='admin-overlay'
          aria-label='Cerrar menú'
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <section className='admin-contenido'>
        <header className='admin-header'>
          <button
            type='button'
            className='admin-menu-toggle'
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto(abierto => !abierto)}
          >
            {menuAbierto ? '×' : '☰'}
          </button>

          <div>
            <p className='admin-header-etiqueta'>VIRTUOSA IND</p>
            <h1>
              {seccionActiva === 'inicio'
                ? 'Inicio'
                : seccionActiva === 'productos'
                ? 'Productos'
                : productoEditando
                ? 'Editar prenda'
                : 'Agregar una prenda'}
            </h1>
          </div>

          <div className='admin-header-acciones'>
            <span className='admin-usuario'>Administradora</span>

            <button
              type='button'
              className='admin-cerrar-sesion'
              onClick={() => void cerrarSesion()}
              disabled={cerrandoSesion}
            >
              {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </header>

        {mensaje && (
          <div className='admin-mensaje' role='status'>
            <span>{mensaje}</span>
            <button
              type='button'
              aria-label='Cerrar mensaje'
              onClick={() => setMensaje('')}
            >
              ×
            </button>
          </div>
        )}

        {seccionActiva === 'inicio' && (
          <div className='admin-inicio'>
            <section className='admin-bienvenida'>
              <p className='admin-eyebrow'>PANEL DE CONTROL</p>
              <h2>Tu tienda, organizada en un solo lugar.</h2>
              <p>
                Administrá las prendas, revisá su estado y actualizá el catálogo
                de VIRTUOSA IND.
              </p>
              <button
                type='button'
                className='admin-boton-principal'
                onClick={abrirFormularioNuevo}
              >
                + Agregar una prenda
              </button>
            </section>

            <div className='admin-resumen'>
              <article>
                <span>Total de prendas</span>
                <strong>{productos.length}</strong>
              </article>
              <article>
                <span>Publicadas</span>
                <strong>{publicados}</strong>
              </article>
              <article>
                <span>Borradores</span>
                <strong>{borradores}</strong>
              </article>
              <article>
                <span>Ocultas</span>
                <strong>{ocultos}</strong>
              </article>
            </div>

            <button
              type='button'
              className='admin-boton-secundario'
              onClick={() => setSeccionActiva('productos')}
            >
              Ver catálogo administrativo →
            </button>
          </div>
        )}

        {seccionActiva === 'productos' && (
          <section className='admin-listado'>
            <div className='admin-listado-titulo'>
              <div>
                <p className='admin-eyebrow'>CATÁLOGO ADMINISTRATIVO</p>
                <h2>Todas las prendas</h2>
                <p>Editá, publicá, ocultá o eliminá productos del catálogo.</p>
              </div>

              <button
                type='button'
                className='admin-boton-principal'
                onClick={abrirFormularioNuevo}
              >
                + Agregar prenda
              </button>
            </div>

            <div className='admin-filtros'>
              <label>
                <span>Buscar</span>
                <input
                  type='search'
                  placeholder='Nombre, descripción o categoría'
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                />
              </label>

              <label>
                <span>Categoría</span>
                <select
                  value={filtroCategoria}
                  onChange={event => setFiltroCategoria(event.target.value)}
                >
                  <option value='Todas'>Todas las categorías</option>
                  {categorias.map(nombreCategoria => (
                    <option key={nombreCategoria} value={nombreCategoria}>
                      {nombreCategoria}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Estado</span>
                <select
                  value={filtroEstado}
                  onChange={event => setFiltroEstado(event.target.value)}
                >
                  <option value='Todos'>Todos los estados</option>
                  <option value='publicado'>Publicados</option>
                  <option value='borrador'>Borradores</option>
                  <option value='oculto'>Ocultos</option>
                </select>
              </label>
            </div>

            {cargando ? (
              <p className='admin-estado-vacio'>Cargando prendas…</p>
            ) : productosFiltrados.length === 0 ? (
              <div className='admin-estado-vacio'>
                <span>◇</span>
                <h3>No encontramos prendas</h3>
                <p>Probá con otra búsqueda o agregá una prenda al catálogo.</p>
                <button
                  type='button'
                  className='admin-boton-secundario'
                  onClick={abrirFormularioNuevo}
                >
                  + Agregar prenda
                </button>
              </div>
            ) : (
              <div className='admin-productos-grid'>
                {productosFiltrados.map(producto => (
                  <article className='admin-producto-card' key={producto.id}>
                    <div className='admin-producto-foto'>
                      {producto.fotos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={producto.fotos[0]} alt={producto.nombre} />
                      ) : (
                        <div className='admin-sin-foto'>
                          <span>◇</span>
                          <small>Sin fotografía</small>
                        </div>
                      )}

                      <span
                        className={`admin-estado admin-estado-${producto.estado}`}
                      >
                        {textoEstado(producto.estado)}
                      </span>
                    </div>

                    <div className='admin-producto-info'>
                      <p className='admin-producto-categoria'>
                        {producto.categoria}
                      </p>
                      <h3>{producto.nombre}</h3>
                      <strong className='admin-producto-precio'>
                        {formatoPrecio(producto.precio)}
                      </strong>
                      <p className='admin-producto-variantes'>
                        {(producto.variantes ?? []).length} combinaciones
                      </p>

                      <div className='admin-producto-acciones'>
                        <button
                          type='button'
                          className='admin-boton-secundario'
                          onClick={() => editarProducto(producto)}
                        >
                          ✎ Editar prenda
                        </button>

                        {producto.estado === 'publicado' ? (
                          <>
                            <button
                              type='button'
                              className='admin-boton-secundario'
                              disabled={productoEnProceso === producto.id}
                              onClick={() =>
                                void cambiarEstadoProducto(producto, 'oculto')
                              }
                            >
                              {productoEnProceso === producto.id
                                ? 'Actualizando…'
                                : 'Ocultar en la tienda'}
                            </button>

                            <button
                              type='button'
                              className='admin-boton-secundario'
                              disabled={productoEnProceso === producto.id}
                              onClick={() =>
                                void cambiarEstadoProducto(producto, 'borrador')
                              }
                            >
                              Volver a borrador
                            </button>
                          </>
                        ) : (
                          <button
                            type='button'
                            className='admin-boton-principal'
                            disabled={productoEnProceso === producto.id}
                            onClick={() =>
                              void cambiarEstadoProducto(producto, 'publicado')
                            }
                          >
                            {productoEnProceso === producto.id
                              ? 'Publicando…'
                              : '↑ Publicar en la tienda'}
                          </button>
                        )}

                        {producto.estado === 'oculto' && (
                          <button
                            type='button'
                            className='admin-boton-secundario'
                            disabled={productoEnProceso === producto.id}
                            onClick={() =>
                              void cambiarEstadoProducto(producto, 'borrador')
                            }
                          >
                            Pasar a borrador
                          </button>
                        )}

                        <button
                          type='button'
                          className='admin-boton-eliminar'
                          disabled={productoEnProceso === producto.id}
                          onClick={() => void eliminarPrenda(producto)}
                        >
                          {productoEnProceso === producto.id
                            ? 'Procesando…'
                            : '× Eliminar prenda'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {seccionActiva === 'agregar' && (
          <section className='admin-formulario-contenedor'>
            <div className='admin-formulario-titulo'>
              <p className='admin-eyebrow'>
                {productoEditando ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
              </p>
              <h2>
                {productoEditando
                  ? 'Actualizá los datos de la prenda'
                  : 'Cargá una nueva prenda'}
              </h2>
              <p>
                Completá la información y guardá la prenda como borrador o
                publicala cuando esté lista.
              </p>
            </div>

            <form
              className='admin-formulario'
              onSubmit={event => {
                event.preventDefault()
                void guardarFormulario(estadoFormulario)
              }}
            >
              <section className='admin-formulario-seccion'>
                <h3>Información general</h3>

                <div className='admin-form-grid'>
                  <label>
                    <span>Nombre de la prenda *</span>
                    <input
                      value={nombre}
                      onChange={event => setNombre(event.target.value)}
                      placeholder='Ej.: Blusa de lino'
                      required
                    />
                  </label>

                  <label>
                    <span>Precio general (ARS) *</span>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={precio}
                      onChange={event => setPrecio(event.target.value)}
                      placeholder='Ej.: 25000'
                      required
                    />
                  </label>

                  <label className='admin-campo-completo'>
                    <span>Categoría *</span>
                    <select
                      value={categoria}
                      onChange={event => setCategoria(event.target.value)}
                      required
                    >
                      {categorias.map(nombreCategoria => (
                        <option key={nombreCategoria} value={nombreCategoria}>
                          {nombreCategoria}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className='admin-campo-completo'>
                    <span>Descripción</span>
                    <textarea
                      value={descripcion}
                      onChange={event => setDescripcion(event.target.value)}
                      placeholder='Contá detalles de la prenda, su tela o calce.'
                      rows={4}
                    />
                  </label>
                </div>
              </section>

              <section className='admin-formulario-seccion'>
                <h3>Fotografías</h3>
                <p>
                  Podés seleccionar varias imágenes. Las nuevas fotos se
                  mostrarán en la tienda después de guardar.
                </p>

                <label
                  className={`admin-selector-fotos ${
                    optimizandoFotos ? 'admin-fotos-optimizando' : ''
                  }`}
                >
                  <span>
                    {optimizandoFotos
                      ? 'Optimizando fotografías…'
                      : '＋ Seleccionar imágenes'}
                  </span>

                  <input
                    type='file'
                    accept='image/*'
                    multiple
                    disabled={optimizandoFotos || guardando}
                    onChange={seleccionarFotos}
                  />
                </label>

                {optimizandoFotos && (
                  <p className='admin-estado-optimizacion' role='status'>
                    Estamos reduciendo el peso de las imágenes. No cierres esta
                    pantalla.
                  </p>
                )}

                {(fotosGuardadas.length > 0 ||
                  previsualizaciones.length > 0) && (
                  <div className='admin-fotos-preview'>
                    {fotosGuardadas.map((foto, index) => (
                      <div className='admin-foto-preview' key={foto}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto} alt={`Foto guardada ${index + 1}`} />
                        <button
                          type='button'
                          aria-label='Quitar fotografía guardada'
                          onClick={() => quitarFotoGuardada(foto)}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {previsualizaciones.map((foto, index) => (
                      <div className='admin-foto-preview' key={foto}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto} alt={`Vista previa ${index + 1}`} />
                        <button
                          type='button'
                          aria-label='Quitar fotografía nueva'
                          onClick={() => quitarFotoNueva(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className='admin-formulario-seccion'>
                <h3>Colores, talles y combinaciones</h3>
                <p>
                  Agregá cada color y cada talle por separado. Después creá
                  solamente las combinaciones que realmente tenga esta prenda.
                </p>

                {variantesFormulario.some(variante =>
                  /[,;\n]/.test(variante.talle)
                ) && (
                  <div className='admin-formulario-mensaje' role='status'>
                    Esta prenda conserva una variante antigua con varios talles
                    agrupados. Creá primero las combinaciones individuales y
                    asigná sus cantidades. Después podés quitar la variante
                    agrupada. No se distribuye el stock automáticamente.
                  </div>
                )}

                <div className='admin-gestor-opciones'>
                  <div className='admin-gestor-bloque'>
                    <h4>1. Colores disponibles</h4>

                    <div className='admin-colores-rapidos'>
                      {coloresPredeterminados.map(color => {
                        const colorAgregado = coloresFormulario.find(
                          item =>
                            item.nombre.toLocaleLowerCase() ===
                            color.nombre.toLocaleLowerCase()
                        )

                        const seleccionado =
                          colorCombinacion.toLocaleLowerCase() ===
                          color.nombre.toLocaleLowerCase()

                        return (
                          <button
                            key={color.nombre}
                            type='button'
                            className={`admin-color-rapido ${
                              seleccionado ? 'seleccionado' : ''
                            }`}
                            onClick={() =>
                              seleccionarColorPredeterminado(color)
                            }
                          >
                            <span
                              className='admin-color-rapido-muestra'
                              style={{ backgroundColor: color.codigo }}
                            />

                            <span className='admin-color-rapido-nombre'>
                              {color.nombre}
                            </span>

                            {colorAgregado && (
                              <span className='admin-color-rapido-check'>
                                ✓
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <div className='admin-color-personalizado'>
                      <h4>Agregar un color personalizado</h4>

                      <div className='admin-gestor-entrada'>
                        <label>
                          <span>Nombre del color</span>
                          <input
                            value={nuevoColor}
                            onChange={event =>
                              setNuevoColor(event.target.value)
                            }
                            placeholder='Ej.: Azul petróleo'
                          />
                        </label>

                        <div className='admin-selector-color-campo'>
                          <span>Muestra</span>

                          <SelectorColor
                            color={nuevoCodigoColor}
                            onChange={setNuevoCodigoColor}
                            label='Elegir tono'
                          />
                        </div>
                        <button
                          type='button'
                          className='admin-boton-secundario'
                          onClick={agregarColorFormulario}
                        >
                          + Agregar color personalizado
                        </button>
                      </div>
                    </div>

                    <div className='admin-opciones-chips'>
                      {coloresFormulario.map(color => (
                        <div className='admin-opcion-chip' key={color.nombre}>
                          <span
                            className='admin-color-muestra'
                            style={{ backgroundColor: color.codigo }}
                            aria-label={color.nombre}
                          />
                          <span>{color.nombre}</span>

                          <SelectorColor
                            color={color.codigo}
                            onChange={codigo =>
                              actualizarColorCodigo(color.nombre, codigo)
                            }
                            label={`Editar ${color.nombre}`}
                            compacto
                          />

                          <button
                            type='button'
                            className='admin-chip-quitar'
                            onClick={() => quitarColorFormulario(color.nombre)}
                            aria-label={`Quitar color ${color.nombre}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='admin-gestor-bloque'>
                    <h4>2. Talles disponibles</h4>

                    <div className='admin-gestor-entrada admin-gestor-talles'>
                      <label>
                        <span>Uno o varios talles</span>
                        <input
                          value={nuevoTalle}
                          onChange={event => setNuevoTalle(event.target.value)}
                          placeholder='Ej.: 1, 2, 3 o S, M, L'
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              agregarTalleFormulario()
                            }
                          }}
                        />
                      </label>

                      <button
                        type='button'
                        className='admin-boton-secundario'
                        onClick={agregarTalleFormulario}
                      >
                        + Agregar talle
                      </button>
                    </div>

                    <p className='admin-ayuda-opciones'>
                      Separá los talles con comas, punto y coma o saltos de
                      línea. Cada talle será una opción independiente.
                    </p>

                    <div className='admin-opciones-chips'>
                      {tallesFormulario.map(talle => (
                        <div
                          className='admin-opcion-chip admin-talle-chip'
                          key={talle}
                        >
                          <strong>{talle}</strong>
                          <button
                            type='button'
                            className='admin-chip-quitar'
                            onClick={() => quitarTalleFormulario(talle)}
                            aria-label={`Quitar talle ${talle}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='admin-gestor-bloque'>
                    <h4>3. Crear una combinación</h4>
                    <p>
                      Seleccioná el color y el talle de una combinación que
                      exista físicamente. No se crearán automáticamente todas
                      las combinaciones posibles.
                    </p>

                    <div className='admin-combinacion-controles'>
                      <label>
                        <span>Color</span>
                        <select
                          value={colorCombinacion}
                          onChange={event =>
                            setColorCombinacion(event.target.value)
                          }
                        >
                          <option value=''>Elegí un color</option>
                          {coloresFormulario.map(color => (
                            <option key={color.nombre} value={color.nombre}>
                              {color.nombre}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className='admin-talles-multiseleccion'>
                        <span className='admin-talles-etiqueta'>
                          Talles (podés elegir varios)
                        </span>

                        <div className='admin-opciones-chips'>
                          {tallesFormulario.map(talle => (
                            <label
                              key={talle}
                              className={`admin-talle-opcion ${
                                tallesCombinacion.includes(talle)
                                  ? 'seleccionado'
                                  : ''
                              }`}
                            >
                              <input
                                type='checkbox'
                                checked={tallesCombinacion.includes(talle)}
                                onChange={event => {
                                  const seleccionado = event.target.checked

                                  setTallesCombinacion(actuales =>
                                    seleccionado
                                      ? actuales.includes(talle)
                                        ? actuales
                                        : [...actuales, talle]
                                      : actuales.filter(item => item !== talle)
                                  )
                                }}
                              />
                              <span>{talle}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button
                        type='button'
                        className='admin-boton-principal'
                        disabled={
                          !colorCombinacion || tallesCombinacion.length === 0
                        }
                        onClick={agregarCombinacion}
                      >
                        + Agregar talles seleccionados
                      </button>
                    </div>
                  </div>
                </div>

                <h4 className='admin-subtitulo-combinaciones'>
                  Combinaciones y stock
                </h4>

                {variantesFormulario.length === 0 ? (
                  <div className='admin-sin-variantes'>
                    <p>
                      Todavía no agregaste combinaciones. Primero agregá colores
                      y talles, y después seleccioná cada combinación real.
                    </p>
                  </div>
                ) : (
                  <div className='admin-variantes-lista'>
                    {variantesFormulario.map((variante, indice) => (
                      <div className='admin-variante-fila' key={variante.id}>
                        <div className='admin-variante-numero'>
                          Combinación {indice + 1}
                        </div>

                        <div className='admin-variante-dato'>
                          <span>Color</span>
                          <div className='admin-variante-color-resumen'>
                            <span
                              className='admin-color-muestra'
                              style={{
                                backgroundColor: variante.codigoColor
                              }}
                            />
                            <strong>{variante.color}</strong>
                          </div>
                        </div>

                        <label>
                          <span>Talle</span>
                          <input value={variante.talle} readOnly />
                        </label>

                        <label>
                          <span>Stock</span>
                          <input
                            type='number'
                            min='0'
                            step='1'
                            value={variante.stock}
                            onChange={event =>
                              actualizarVariante(
                                variante.id,
                                'stock',
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <button
                          type='button'
                          className='admin-boton-eliminar'
                          onClick={() => quitarVariante(variante.id)}
                        >
                          × Quitar combinación
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className='admin-formulario-seccion'>
                <h3>Publicación</h3>
                <p>
                  Los borradores no son visibles para los clientes. Podés
                  publicar la prenda ahora o guardarla para más adelante.
                </p>

                <label>
                  <span>Estado al guardar</span>
                  <select
                    value={estadoFormulario}
                    onChange={event =>
                      setEstadoFormulario(event.target.value as EstadoProducto)
                    }
                  >
                    <option value='borrador'>Borrador</option>
                    <option value='publicado'>Publicado en la tienda</option>
                    <option value='oculto'>Oculto en la tienda</option>
                  </select>
                </label>
              </section>

              {mensaje && (
                <p className='admin-formulario-mensaje' role='status'>
                  {mensaje}
                </p>
              )}

              <div className='admin-formulario-acciones'>
                <button
                  type='button'
                  className='admin-boton-secundario'
                  disabled={guardando}
                  onClick={() => {
                    limpiarFormulario()
                    setSeccionActiva('productos')
                  }}
                >
                  Cancelar
                </button>

                <button
                  type='button'
                  className='admin-boton-secundario'
                  disabled={guardando}
                  onClick={() => void guardarFormulario('borrador')}
                >
                  Guardar como borrador
                </button>

                <button
                  type='submit'
                  className='admin-boton-principal'
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando…'
                    : estadoFormulario === 'publicado'
                    ? 'Guardar y publicar'
                    : estadoFormulario === 'oculto'
                    ? 'Guardar como oculto'
                    : 'Guardar cambios'}
                </button>

                {productoEditando && (
                  <button
                    type='button'
                    className='admin-boton-eliminar'
                    disabled={guardando}
                    onClick={() => void eliminarPrenda(productoEditando)}
                  >
                    × Eliminar prenda
                  </button>
                )}
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  )
}
