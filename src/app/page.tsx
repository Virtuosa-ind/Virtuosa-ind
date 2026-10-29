'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  obtenerCatalogoPublicado,
  type OpcionColor,
  type ProductoTienda
} from '@/lib/supabase/catalogo'
const categorias = [
  'Remeras y musculosas',
  'Blusas y camisas',
  'Pantalones',
  'Jeans',
  'Shorts y bermudas',
  'Vestidos',
  'Camperas',
  'Suéteres',
  'Conjuntos',
  'Outfits',
  'Accesorios',
  'SALE'
]

type ItemCarrito = {
  producto: ProductoTienda
  cantidad: number
  talle: string
  color: OpcionColor
  precioUnitario: number
}

function formatoPrecio (precio: number) {
  return `$${precio.toLocaleString('es-AR')}`
}

export default function Home () {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [productoAbierto, setProductoAbierto] = useState<ProductoTienda | null>(
    null
  )
  const [fotoActiva, setFotoActiva] = useState(0)

  const [categoriaActiva, setCategoriaActiva] = useState('Todos los productos')

  const [productos, setProductos] = useState<ProductoTienda[]>([])
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [errorCatalogo, setErrorCatalogo] = useState('')

  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [consultaCliente, setConsultaCliente] = useState('')

  const [tallesElegidos, setTallesElegidos] = useState<Record<string, string>>(
    {}
  )

  const [coloresElegidos, setColoresElegidos] = useState<
    Record<string, string>
  >({})

  // Cargar únicamente los productos publicados en Supabase.
  useEffect(() => {
    let activo = true

    async function cargarCatalogo () {
      try {
        setErrorCatalogo('')

        const catalogo = await obtenerCatalogoPublicado()

        if (activo) {
          setProductos(catalogo)
        }
      } catch (error) {
        console.error('Error al cargar el catálogo:', error)

        if (activo) {
          setErrorCatalogo(
            'No pudimos cargar las prendas. Revisá tu conexión e intentá nuevamente.'
          )
        }
      } finally {
        if (activo) {
          setCargandoCatalogo(false)
        }
      }
    }

    void cargarCatalogo()

    return () => {
      activo = false
    }
  }, [])

  const productosFiltrados = productos.filter(
    producto =>
      categoriaActiva === 'Todos los productos' ||
      producto.categoria === categoriaActiva
  )

  const cantidadCarrito = carrito.reduce(
    (total, item) => total + item.cantidad,
    0
  )

  const totalCarrito = carrito.reduce(
    (total, item) => total + item.precioUnitario * item.cantidad,
    0
  )
  const fotosDetalle = productoAbierto
    ? productoAbierto.imagenes?.length
      ? productoAbierto.imagenes
      : productoAbierto.imagen
      ? [productoAbierto.imagen]
      : []
    : []

  const fotoVisible = fotosDetalle[fotoActiva] ?? fotosDetalle[0] ?? ''

  function seleccionarCategoria (categoria: string) {
    setCategoriaActiva(categoria)
    setMenuAbierto(false)

    document.getElementById('productos')?.scrollIntoView({
      behavior: 'smooth'
    })
  }

  function agregarAlCarrito (producto: ProductoTienda): boolean {
    let talle = 'Único'

    let color: OpcionColor = {
      nombre: 'Único',
      codigo: '#f5f0f1'
    }

    // Cada prenda tiene un único precio.
    const precioUnitario = producto.precio

    // Si no se informó el stock, la disponibilidad se confirma por WhatsApp.
    let stockDisponible: number | null = null

    // Los productos con variantes requieren elegir una combinación existente.
    if (producto.variantes.length > 0) {
      talle = tallesElegidos[producto.id] || ''

      const nombreColor = coloresElegidos[producto.id] || ''

      if (!talle || !nombreColor) {
        alert(
          'Elegí el talle y el color antes de agregar la prenda al carrito.'
        )

        return false
      }

      const variante = producto.variantes.find(
        opcion => opcion.color === nombreColor && opcion.talle === talle
      )

      if (!variante) {
        alert('Esa combinación de color y talle no está disponible.')

        return false
      }

      if (typeof variante.stock === 'number' && variante.stock <= 0) {
        alert('Esta variante está agotada. Elegí otra combinación.')

        return false
      }

      stockDisponible = variante.stock

      color = {
        nombre: variante.color,
        codigo:
          variante.colorCodigo ||
          producto.colores.find(opcion => opcion.nombre === variante.color)
            ?.codigo ||
          '#929292'
      }
    }

    // Buscar si la misma combinación ya está en el carrito.
    const existente = carrito.find(
      item =>
        item.producto.id === producto.id &&
        item.talle === talle &&
        item.color.nombre === color.nombre
    )

    const cantidadActual = existente?.cantidad ?? 0

    // Si hay stock registrado, no permitir superar esa cantidad.
    if (
      typeof stockDisponible === 'number' &&
      cantidadActual >= stockDisponible
    ) {
      alert(
        `Solo hay ${stockDisponible} unidad(es) disponibles de esta combinación.`
      )

      return false
    }

    setCarrito(actual => {
      const yaExiste = actual.some(
        item =>
          item.producto.id === producto.id &&
          item.talle === talle &&
          item.color.nombre === color.nombre
      )

      if (yaExiste) {
        return actual.map(item =>
          item.producto.id === producto.id &&
          item.talle === talle &&
          item.color.nombre === color.nombre
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }

      return [
        ...actual,
        {
          producto,
          cantidad: 1,
          talle,
          color,
          precioUnitario
        }
      ]
    })

    return true
  }

  function cambiarCantidad (
    id: string,
    talle: string,
    colorNombre: string,
    cambio: number
  ) {
    const itemActual = carrito.find(
      item =>
        item.producto.id === id &&
        item.talle === talle &&
        item.color.nombre === colorNombre
    )

    // Antes de aumentar, verificamos el stock de esa combinación.
    if (cambio > 0 && itemActual) {
      const variante = itemActual.producto.variantes.find(
        opcion => opcion.color === colorNombre && opcion.talle === talle
      )

      const stock = variante?.stock

      if (typeof stock === 'number' && itemActual.cantidad + cambio > stock) {
        alert(`Solo hay ${stock} unidad(es) disponibles de esta combinación.`)

        return
      }
    }

    setCarrito(actual =>
      actual
        .map(item =>
          item.producto.id === id &&
          item.talle === talle &&
          item.color.nombre === colorNombre
            ? { ...item, cantidad: item.cantidad + cambio }
            : item
        )
        .filter(item => item.cantidad > 0)
    )
  }

  function eliminarDelCarrito (id: string, talle: string, colorNombre: string) {
    setCarrito(actual =>
      actual.filter(
        item =>
          !(
            item.producto.id === id &&
            item.talle === talle &&
            item.color.nombre === colorNombre
          )
      )
    )
  }

  function prepararPedidoWhatsApp () {
    if (carrito.length === 0) return

    const lineas = carrito.map(
      item =>
        `• ${item.producto.nombre} | Color: ${item.color.nombre} | Talle: ${
          item.talle
        } | Cantidad: ${item.cantidad} | Subtotal: ${formatoPrecio(
          item.precioUnitario * item.cantidad
        )}`
    )

    const mensaje = [
      '¡Hola! Quiero consultar por este pedido de VIRTUOSA IND.:',
      '',
      ...lineas,
      '',
      `Total estimado: ${formatoPrecio(totalCarrito)}`,
      '',
      'Mi consulta:',
      consultaCliente.trim() || 'No agregué ninguna consulta adicional.',
      '',
      '¿Me confirman la disponibilidad, por favor?'
    ].join('\n')

    const numeroWhatsApp = '543412701052'

    window.open(
      `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <main>
      <div className='barra-superior'>
        <span>MODA CON PROPÓSITO</span>
        <span className='barra-separador'>✦</span>
        <span>TU CONFIANZA</span>
        <span className='barra-separador'>✦</span>
        <span>TU FUERZA</span>
      </div>

      <header className='encabezado'>
        <button
          className='boton-menu'
          type='button'
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto(actual => !actual)}
        >
          {menuAbierto ? '✕' : '☰'}
        </button>

        <a className='marca' href='#inicio' aria-label='VIRTUOSA IND, inicio'>
          <Image
            src='/logo-virtuosa-nuevo.png'
            alt='Logo de VIRTUOSA'
            width={1024}
            height={1024}
            priority
            className='marca-logo-img'
          />
        </a>

        <button
          className='boton-carrito'
          type='button'
          onClick={() => setCarritoAbierto(true)}
          aria-label={`Abrir carrito. ${cantidadCarrito} productos`}
        >
          <span className='icono-corazon' aria-hidden='true'>
            ♡
          </span>
          <span className='texto-carrito'>Mi carrito</span>
          <span className='contador-carrito'>{cantidadCarrito}</span>
        </button>
      </header>

      {menuAbierto && (
        <>
          <button
            className='fondo-menu'
            type='button'
            aria-label='Cerrar menú'
            onClick={() => setMenuAbierto(false)}
          />

          <aside className='panel-menu' aria-label='Menú de la tienda'>
            <div className='encabezado-menu'>
              <div>
                <span className='etiqueta-dorada'>VIRTUOSA IND.</span>
                <h2>Explorá la tienda</h2>
              </div>

              <button
                type='button'
                className='cerrar-panel'
                onClick={() => setMenuAbierto(false)}
                aria-label='Cerrar menú'
              >
                ✕
              </button>
            </div>

            <button
              className={`enlace-menu ${
                categoriaActiva === 'Todos los productos' ? 'activo' : ''
              }`}
              type='button'
              onClick={() => seleccionarCategoria('Todos los productos')}
            >
              Todos los productos <span>›</span>
            </button>

            <p className='titulo-categorias-menu'>CATEGORÍAS</p>

            <nav className='enlaces-menu'>
              {categorias.map((categoria, indice) => (
                <button
                  className={`enlace-menu ${
                    categoriaActiva === categoria ? 'activo' : ''
                  }`}
                  type='button'
                  key={categoria}
                  onClick={() => seleccionarCategoria(categoria)}
                >
                  <span className='numero-menu'>
                    {String(indice + 1).padStart(2, '0')}
                  </span>
                  <span className='nombre-menu'>{categoria}</span>
                  <span className='flecha-menu'>›</span>
                </button>
              ))}
            </nav>

            <button
              className='boton-menu-carrito'
              type='button'
              onClick={() => {
                setMenuAbierto(false)
                setCarritoAbierto(true)
              }}
            >
              Ver mi carrito <span>♡</span>
            </button>
          </aside>
        </>
      )}

      <section className='portada' id='inicio'>
        <div className='portada-contenido'>
          <span className='etiqueta-portada'>NUEVA FORMA DE EXPRESARTE</span>
          <h1>
            Tu estilo.
            <br />
            <span>Tu esencia.</span>
          </h1>
          <p className='descripcion-portada'>
            Prendas y accesorios para sentirte vos misma. Encontrá ese estilo
            que habla de quién sos.
          </p>
          <button
            className='boton-principal'
            type='button'
            onClick={() => setMenuAbierto(true)}
          >
            EXPLORAR COLECCIÓN <span>↗</span>
          </button>
        </div>

        <div className='portada-visual' aria-label='Presentación de la marca'>
          <div className='marco-portada'>
            <span className='marco-esquina esquina-superior' />
            <div className='portada-iniciales'>
              V<span>.</span>I
            </div>
            <div className='linea-portada' />
            <p>VIRTUOSA IND.</p>
            <span className='marco-esquina esquina-inferior' />
          </div>
        </div>
      </section>

      <section className='franja-informativa'>
        <span>MODA</span>
        <span className='separador-franja'>✦</span>
        <span>IDENTIDAD</span>
        <span className='separador-franja'>✦</span>
        <span>CONFIANZA</span>
      </section>

      {/* CATÁLOGO CONECTADO A SUPABASE */}
      <section className='productos' id='productos'>
        <div className='encabezado-productos'>
          <div>
            <span className='etiqueta-dorada'>SELECCIÓN VIRTUOSA</span>
            <h2>
              {categoriaActiva === 'Todos los productos'
                ? 'Nuestra colección'
                : categoriaActiva}
            </h2>
            <p>
              {categoriaActiva === 'Accesorios'
                ? 'Encontrá accesorios que reflejen tu personalidad.'
                : 'Encontrá prendas que reflejen tu personalidad.'}
            </p>
          </div>

          {categoriaActiva !== 'Todos los productos' && (
            <button
              type='button'
              className='boton-ver-todo'
              onClick={() => setCategoriaActiva('Todos los productos')}
            >
              Ver todo <span>↗</span>
            </button>
          )}
        </div>

        {cargandoCatalogo ? (
          <div className='catalogo-vacio'>
            <span className='etiqueta-dorada'>VIRTUOSA IND.</span>
            <h3>Cargando nuestra colección...</h3>
            <p>Estamos buscando las prendas disponibles.</p>
          </div>
        ) : errorCatalogo ? (
          <div className='catalogo-vacio'>
            <span className='etiqueta-dorada'>VIRTUOSA IND.</span>
            <h3>No pudimos cargar la colección</h3>
            <p>{errorCatalogo}</p>
            <button
              type='button'
              className='boton-secundario'
              onClick={() => window.location.reload()}
            >
              VOLVER A INTENTAR
            </button>
          </div>
        ) : productosFiltrados.length > 0 ? (
          <div className='grilla-productos'>
            {productosFiltrados.map(producto => (
              <article className='tarjeta-producto' key={producto.id}>
                <div className='producto-fotos-tarjeta'>
                  <button
                    type='button'
                    className='foto-producto foto-producto-boton'
                    aria-label={`Ver detalles de ${producto.nombre}`}
                    onClick={() => {
                      setFotoActiva(0)
                      setProductoAbierto(producto)
                    }}
                    style={
                      !(producto.imagenes?.[0] || producto.imagen)
                        ? {
                            background: `linear-gradient(145deg, ${
                              producto.colores[0]?.codigo || '#f4dce5'
                            } 0%, #f5f0f1 100%)`
                          }
                        : undefined
                    }
                  >
                    {producto.imagenes?.[0] || producto.imagen ? (
                      <img
                        src={producto.imagenes?.[0] || producto.imagen}
                        alt={producto.nombre}
                      />
                    ) : (
                      <div className='imagen-sin-foto'>
                        <span className='texto-prenda-prueba'>
                          V<span>.</span>I
                        </span>
                        <span>{producto.nombre}</span>
                      </div>
                    )}
                  </button>

                  {producto.imagenes && producto.imagenes.length > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        paddingTop: '8px',
                        paddingBottom: '4px'
                      }}
                    >
                      {producto.imagenes.slice(1).map((foto, indice) => (
                        <img
                          key={`${producto.id}-foto-${indice}`}
                          src={foto}
                          alt={`${producto.nombre} - foto ${indice + 1}`}
                          loading='lazy'
                          style={{
                            width: '56px',
                            height: '68px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            flex: '0 0 auto'
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className='datos-producto'>
                  <h3>{producto.nombre}</h3>
                  <p className='precio-producto'>
                    {formatoPrecio(producto.precio)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className='catalogo-vacio'>
            <div className='icono-catalogo'>♡</div>
            <span className='etiqueta-dorada'>
              {productos.length === 0 ? 'PRÓXIMAMENTE' : 'COLECCIÓN'}
            </span>
            <h3>
              {productos.length === 0
                ? 'Tu próxima prenda favorita te espera'
                : categoriaActiva === 'Accesorios'
                ? 'Todavía no hay accesorios en esta categoría'
                : 'Todavía no hay prendas en esta categoría'}
            </h3>
            <p>
              {productos.length === 0
                ? 'Estamos preparando el catálogo. Pronto vas a encontrar fotos, talles y precios de nuestras prendas.'
                : 'Estamos preparando esta parte de la colección.'}
            </p>

            {categoriaActiva !== 'Todos los productos' && (
              <button
                className='boton-secundario'
                type='button'
                onClick={() => setCategoriaActiva('Todos los productos')}
              >
                VER TODA LA COLECCIÓN
              </button>
            )}
          </div>
        )}
      </section>

      {/* DETALLES DE LA PRENDA */}
      {productoAbierto && (
        <div
          className='fondo-detalle-producto'
          onClick={() => setProductoAbierto(null)}
        >
          <section
            className='detalle-producto-modal'
            role='dialog'
            aria-modal='true'
            aria-labelledby='titulo-detalle-producto'
            onClick={evento => evento.stopPropagation()}
          >
            <button
              type='button'
              className='cerrar-detalle-producto'
              aria-label='Cerrar detalles'
              onClick={() => setProductoAbierto(null)}
            >
              ✕
            </button>

            <div
              className='detalle-producto-galeria'
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                minWidth: 0
              }}
            >
              <div
                className='detalle-producto-imagen'
                style={
                  !fotoVisible
                    ? {
                        background: `linear-gradient(145deg, ${
                          productoAbierto.colores[0]?.codigo || '#f4dce5'
                        } 0%, #f5f0f1 100%)`
                      }
                    : undefined
                }
              >
                {fotoVisible ? (
                  <img
                    src={fotoVisible}
                    alt={`${productoAbierto.nombre} - foto ${fotoActiva + 1}`}
                  />
                ) : (
                  <div className='imagen-sin-foto'>
                    <span className='texto-prenda-prueba'>
                      V<span>.</span>I
                    </span>
                    <span>{productoAbierto.nombre}</span>
                  </div>
                )}
              </div>

              {fotosDetalle.length > 1 && (
                <div
                  className='detalle-producto-miniaturas'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    minWidth: 0
                  }}
                >
                  <button
                    type='button'
                    aria-label='Ver foto anterior'
                    title='Foto anterior'
                    onClick={() =>
                      setFotoActiva(
                        actual =>
                          (actual - 1 + fotosDetalle.length) %
                          fotosDetalle.length
                      )
                    }
                    style={{
                      flex: '0 0 32px',
                      height: '36px',
                      border: '1px solid #c5a052',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '22px'
                    }}
                  >
                    ‹
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      gap: '7px',
                      overflowX: 'auto',
                      minWidth: 0,
                      padding: '3px',
                      flex: '1 1 auto'
                    }}
                  >
                    {fotosDetalle.map((foto, indice) =>
                      indice === fotoActiva ? null : (
                        <button
                          key={`${productoAbierto.id}-detalle-foto-${indice}`}
                          type='button'
                          aria-label={`Ver foto ${indice + 1}`}
                          title={`Ver foto ${indice + 1}`}
                          onClick={() => setFotoActiva(indice)}
                          style={{
                            flex: '0 0 62px',
                            width: '62px',
                            height: '76px',
                            padding: 0,
                            overflow: 'hidden',
                            border: '1px solid #c5a052',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={foto}
                            alt={`${productoAbierto.nombre} - foto ${
                              indice + 1
                            }`}
                            loading='lazy'
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                          />
                        </button>
                      )
                    )}
                  </div>

                  <button
                    type='button'
                    aria-label='Ver foto siguiente'
                    title='Foto siguiente'
                    onClick={() =>
                      setFotoActiva(
                        actual => (actual + 1) % fotosDetalle.length
                      )
                    }
                    style={{
                      flex: '0 0 32px',
                      height: '36px',
                      border: '1px solid #c5a052',
                      borderRadius: '6px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '22px'
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            <div className='detalle-producto-contenido'>
              <span className='etiqueta-dorada'>
                {productoAbierto.categoria}
              </span>

              <h2 id='titulo-detalle-producto'>{productoAbierto.nombre}</h2>

              <p className='precio-producto'>
                {formatoPrecio(productoAbierto.precio)}
              </p>

              {productoAbierto.descripcion?.trim() && (
                <div className='descripcion-detalle-producto'>
                  <h3>Descripción</h3>
                  <p>{productoAbierto.descripcion}</p>
                </div>
              )}

              {productoAbierto.variantes.length > 0 && (
                <>
                  <div className='selector-variante'>
                    <span className='etiqueta-selector'>
                      Color:{' '}
                      <strong>
                        {coloresElegidos[productoAbierto.id] ||
                          'Elegí un color'}
                      </strong>
                    </span>

                    <div className='opciones-colores'>
                      {productoAbierto.colores.map(color => {
                        const variantesColor = productoAbierto.variantes.filter(
                          variante => variante.color === color.nombre
                        )

                        const todasAgotadas =
                          variantesColor.length > 0 &&
                          variantesColor.every(
                            variante =>
                              typeof variante.stock === 'number' &&
                              variante.stock <= 0
                          )

                        return (
                          <button
                            key={color.nombre}
                            type='button'
                            className={`muestra-color ${
                              coloresElegidos[productoAbierto.id] ===
                              color.nombre
                                ? 'color-seleccionado'
                                : ''
                            }`}
                            style={{ backgroundColor: color.codigo }}
                            title={
                              todasAgotadas
                                ? `${color.nombre} — agotado`
                                : color.nombre
                            }
                            aria-label={`Elegir color ${color.nombre}${
                              todasAgotadas ? ', agotado' : ''
                            }`}
                            aria-pressed={
                              coloresElegidos[productoAbierto.id] ===
                              color.nombre
                            }
                            onClick={() =>
                              setColoresElegidos(actual => ({
                                ...actual,
                                [productoAbierto.id]: color.nombre
                              }))
                            }
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div className='selector-variante'>
                    <span className='etiqueta-selector'>
                      Talle:{' '}
                      <strong>
                        {tallesElegidos[productoAbierto.id] || 'Elegí un talle'}
                      </strong>
                    </span>

                    <div className='opciones-talles'>
                      {productoAbierto.talles.map(talle => {
                        const colorElegido = coloresElegidos[productoAbierto.id]

                        const variante = productoAbierto.variantes.find(
                          opcion =>
                            opcion.talle === talle &&
                            opcion.color === colorElegido
                        )

                        const agotado =
                          typeof variante?.stock === 'number' &&
                          variante.stock <= 0
                        const combinacionInexistente =
                          Boolean(colorElegido) && !variante

                        return (
                          <button
                            key={talle}
                            type='button'
                            className={`opcion-talle ${
                              tallesElegidos[productoAbierto.id] === talle
                                ? 'talle-seleccionado'
                                : ''
                            }`}
                            aria-pressed={
                              tallesElegidos[productoAbierto.id] === talle
                            }
                            title={
                              agotado
                                ? 'Agotada'
                                : combinacionInexistente
                                ? 'Combinación no disponible'
                                : `Talle ${talle}`
                            }
                            onClick={() =>
                              setTallesElegidos(actual => ({
                                ...actual,
                                [productoAbierto.id]: talle
                              }))
                            }
                          >
                            {talle}
                          </button>
                        )
                      })}
                    </div>

                    {coloresElegidos[productoAbierto.id] &&
                      tallesElegidos[productoAbierto.id] &&
                      (() => {
                        const variante = productoAbierto.variantes.find(
                          opcion =>
                            opcion.color ===
                              coloresElegidos[productoAbierto.id] &&
                            opcion.talle === tallesElegidos[productoAbierto.id]
                        )

                        if (!variante) {
                          return (
                            <p className='detalle-variante-aviso'>
                              Esta combinación no está disponible.
                            </p>
                          )
                        }

                        if (
                          typeof variante.stock === 'number' &&
                          variante.stock <= 0
                        ) {
                          return (
                            <p className='detalle-variante-aviso'>Agotada</p>
                          )
                        }

                        return null
                      })()}
                  </div>
                </>
              )}

              <button
                className='boton-agregar'
                type='button'
                onClick={() => {
                  if (agregarAlCarrito(productoAbierto)) {
                    setProductoAbierto(null)
                  }
                }}
              >
                AGREGAR AL CARRITO <span>＋</span>
              </button>
            </div>
          </section>
        </div>
      )}

      <section className='seccion-contacto' id='contacto'>
        <span className='etiqueta-dorada'>ESTAMOS PARA VOS</span>
        <h2>¿Tenés alguna consulta?</h2>
        <p>Escribinos y te ayudamos a encontrar lo que buscás.</p>

        <div className='botones-contacto'>
          <a
            href='https://www.instagram.com/virtuosaind_/'
            target='_blank'
            rel='noopener noreferrer'
            className='boton-contacto boton-instagram'
            aria-label='Visitar nuestro Instagram'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='3' y='3' width='18' height='18' rx='5' />
              <circle cx='12' cy='12' r='4' />
              <circle cx='17.5' cy='6.5' r='0.8' fill='currentColor' />
            </svg>
            Instagram
          </a>

          <a
            href='https://wa.me/543412701052'
            target='_blank'
            rel='noopener noreferrer'
            className='boton-contacto boton-whatsapp'
            aria-label='Contactarnos por WhatsApp'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z' />
            </svg>
            WhatsApp
          </a>
        </div>
      </section>

      <footer className='pie'>
        <a
          className='logo logo-pie'
          href='#inicio'
          aria-label='VIRTUOSA IND, volver al inicio'
        >
          <Image
            src='/logo-virtuosa-sin-fondo.png'
            alt='Logo de VIRTUOSA'
            width={550}
            height={550}
            className='logo-pie-img'
          />
        </a>

        <p>Vestida de fuerza y dignidad · Sin temor al futuro</p>
        <small>© 2026 VIRTUOSA IND. Todos los derechos reservados.</small>
      </footer>

      {carritoAbierto && (
        <div className='fondo-carrito' onClick={() => setCarritoAbierto(false)}>
          <aside
            className='panel-carrito'
            role='dialog'
            aria-modal='true'
            aria-labelledby='titulo-carrito'
            onClick={evento => evento.stopPropagation()}
          >
            <div className='encabezado-carrito'>
              <div>
                <span className='etiqueta-dorada'>TU SELECCIÓN</span>
                <h2 id='titulo-carrito'>Mi carrito</h2>
              </div>

              <button
                className='cerrar-panel'
                type='button'
                onClick={() => setCarritoAbierto(false)}
                aria-label='Cerrar carrito'
              >
                ✕
              </button>
            </div>

            {carrito.length === 0 ? (
              <div className='carrito-vacio'>
                <span className='icono-catalogo'>♡</span>
                <h3>Tu carrito está vacío</h3>
                <p>Las prendas que elijas van a aparecer acá.</p>

                <button
                  className='boton-principal'
                  type='button'
                  onClick={() => setCarritoAbierto(false)}
                >
                  SEGUIR EXPLORANDO
                </button>
              </div>
            ) : (
              <>
                <div className='lista-carrito'>
                  {carrito.map(item => (
                    <article
                      className='item-carrito'
                      key={`${item.producto.id}-${item.talle}-${item.color.nombre}`}
                    >
                      {item.producto.imagen ? (
                        <img
                          src={item.producto.imagen}
                          alt={item.producto.nombre}
                        />
                      ) : (
                        <div
                          className='imagen-sin-foto imagen-carrito-color'
                          style={{ backgroundColor: item.color.codigo }}
                        >
                          {item.producto.nombre}
                        </div>
                      )}

                      <div className='info-item-carrito'>
                        <h3>{item.producto.nombre}</h3>
                        {item.talle !== 'Único' && <p>Talle: {item.talle}</p>}

                        {item.color.nombre !== 'Único' && (
                          <p className='detalle-color-carrito'>
                            Color:
                            <span
                              className='muestra-color mini-color'
                              style={{ backgroundColor: item.color.codigo }}
                              aria-label={item.color.nombre}
                            />
                            {item.color.nombre}
                          </p>
                        )}

                        <strong>
                          {formatoPrecio(item.precioUnitario * item.cantidad)}
                        </strong>

                        <div className='acciones-cantidad'>
                          <div className='controles-cantidad'>
                            <button
                              type='button'
                              aria-label='Disminuir cantidad'
                              onClick={() =>
                                cambiarCantidad(
                                  item.producto.id,
                                  item.talle,
                                  item.color.nombre,
                                  -1
                                )
                              }
                            >
                              −
                            </button>

                            <span>{item.cantidad}</span>

                            <button
                              type='button'
                              aria-label='Aumentar cantidad'
                              onClick={() =>
                                cambiarCantidad(
                                  item.producto.id,
                                  item.talle,
                                  item.color.nombre,
                                  1
                                )
                              }
                            >
                              +
                            </button>
                          </div>

                          <button
                            type='button'
                            className='boton-eliminar-prenda'
                            aria-label={`Eliminar ${item.producto.nombre} del carrito`}
                            title='Eliminar prenda'
                            onClick={() =>
                              eliminarDelCarrito(
                                item.producto.id,
                                item.talle,
                                item.color.nombre
                              )
                            }
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              width='18'
                              height='18'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='1.7'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              aria-hidden='true'
                            >
                              <path d='M3 6h18' />
                              <path d='M8 6V4h8v2' />
                              <path d='m19 6-1 14H6L5 6' />
                              <path d='M10 11v5' />
                              <path d='M14 11v5' />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className='resumen-carrito'>
                  <div className='fila-total'>
                    <span>Total estimado</span>
                    <strong>{formatoPrecio(totalCarrito)}</strong>
                  </div>

                  <p>
                    El envío, la disponibilidad y el total final se confirman
                    por WhatsApp.
                  </p>

                  <div className='consulta-carrito'>
                    <label htmlFor='consulta-cliente'>
                      ¿Tenés alguna pregunta?
                    </label>

                    <p>
                      Escribinos tu consulta sobre las prendas, los talles, los
                      colores o el retiro/envío del pedido.
                    </p>

                    <textarea
                      id='consulta-cliente'
                      value={consultaCliente}
                      onChange={evento =>
                        setConsultaCliente(evento.target.value)
                      }
                      placeholder='Escribí tu consulta acá...'
                      rows={4}
                      maxLength={1000}
                    />

                    <span className='contador-consulta'>
                      {consultaCliente.length}/1000 caracteres
                    </span>
                  </div>

                  <button
                    className='boton-principal boton-whatsapp'
                    type='button'
                    onClick={prepararPedidoWhatsApp}
                  >
                    CONTINUAR POR WHATSAPP <span>↗</span>
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <a
        href='https://wa.me/543412701052?text=%C2%A1Hola!%20Quiero%20hacer%20una%20consulta%20sobre%20VIRTUOSA%20IND.'
        className='whatsapp-flotante'
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Consultar por WhatsApp'
        title='Escribinos por WhatsApp'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          width='30'
          height='30'
          fill='currentColor'
          aria-hidden='true'
        >
          <path d='M12 2a9.8 9.8 0 0 0-8.5 14.7L2 22l5.5-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.2.8.9-3.1-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.6c-.1-.2 0-.4.1-.5l.4-.5.2-.4c.1-.2 0-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3a9 9 0 0 0 3.5 3.1c.5.2.9.4 1.2.4.5.2.9.1 1.2.1.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.4-.3Z' />
        </svg>
      </a>
    </main>
  )
}
