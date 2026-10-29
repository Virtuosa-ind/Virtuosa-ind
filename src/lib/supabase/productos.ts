import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/lib/productos'

type ProductoDB = {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  precio: number | string
  estado: 'borrador' | 'publicado' | 'oculto'
  created_at: string
  updated_at: string
}

type VarianteDB = {
  id: string
  product_id: string
  color_nombre: string
  color_codigo: string
  talle: string
  stock: number | null
}

type FotoDB = {
  id: string
  product_id: string
  storage_path: string
  orden: number
}

type ColorEntrada = {
  nombre: string
  codigo: string
}

/* =========================================================
   FOTOGRAFÍAS
   ========================================================= */

function crearUrlFoto (storagePath: string): string {
  const supabase = createClient()

  const { data } = supabase.storage.from('prendas').getPublicUrl(storagePath)

  return data.publicUrl
}

/* =========================================================
   OBTENER PRODUCTOS
   ========================================================= */

export async function obtenerProductosSupabase (): Promise<Producto[]> {
  const supabase = createClient()

  const { data: filasProductos, error: errorProductos } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (errorProductos) {
    throw new Error(
      `No se pudieron cargar los productos: ${errorProductos.message}`
    )
  }

  const productosDB = (filasProductos ?? []) as ProductoDB[]

  if (productosDB.length === 0) {
    return []
  }

  const ids = productosDB.map(producto => producto.id)

  const [resultadoVariantes, resultadoFotos] = await Promise.all([
    supabase.from('product_variants').select('*').in('product_id', ids),

    supabase
      .from('product_images')
      .select('*')
      .in('product_id', ids)
      .order('orden', { ascending: true })
  ])

  if (resultadoVariantes.error) {
    throw new Error(
      `No se pudieron cargar las variantes: ${resultadoVariantes.error.message}`
    )
  }

  if (resultadoFotos.error) {
    throw new Error(
      `No se pudieron cargar las fotografías: ${resultadoFotos.error.message}`
    )
  }

  const variantesDB = (resultadoVariantes.data ?? []) as VarianteDB[]
  const fotosDB = (resultadoFotos.data ?? []) as FotoDB[]

  return productosDB.map(producto => ({
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    categoria: producto.categoria,
    precio: Number(producto.precio),

    fotos: fotosDB
      .filter(foto => foto.product_id === producto.id)
      .map(foto => crearUrlFoto(foto.storage_path)),

    variantes: variantesDB
      .filter(variante => variante.product_id === producto.id)
      .map(variante => ({
        id: variante.id,
        color: variante.color_nombre,
        colorCodigo: variante.color_codigo,
        talle: variante.talle,
        stock: variante.stock
      })),

    estado: producto.estado,
    creadoEn: producto.created_at,
    actualizadoEn: producto.updated_at
  }))
}

/* =========================================================
   GUARDAR O ACTUALIZAR UNA PRENDA
   ========================================================= */

export async function guardarProductoSupabase (
  producto: Producto,
  archivos: File[],
  colores: ColorEntrada[]
): Promise<void> {
  const supabase = createClient()

  /* 1. Consultar las fotografías que ya existen. */

  const { data: fotosAnteriores, error: errorLeerFotos } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', producto.id)
    .order('orden', { ascending: true })

  if (errorLeerFotos) {
    throw new Error(
      `No se pudieron consultar las fotografías anteriores: ${errorLeerFotos.message}`
    )
  }

  const fotosExistentes = (fotosAnteriores ?? []) as FotoDB[]

  /* 2. Identificar cuáles se conservarán. */

  const fotosConservar: FotoDB[] = []

  for (const url of producto.fotos ?? []) {
    const foto = fotosExistentes.find(
      item => crearUrlFoto(item.storage_path) === url
    )

    if (foto && !fotosConservar.some(item => item.id === foto.id)) {
      fotosConservar.push(foto)
    }
  }

  /* 3. Preparar la limpieza de las fotografías nuevas. */

  const nuevasFotos: { storage_path: string }[] = []

  async function limpiarFotosNuevas (): Promise<void> {
    const rutas = nuevasFotos.map(foto => foto.storage_path)

    if (rutas.length === 0) {
      return
    }

    try {
      const { error } = await supabase.storage.from('prendas').remove(rutas)

      if (error) {
        console.error(
          'No se pudieron limpiar algunas fotografías nuevas:',
          error.message
        )
      }
    } catch (error) {
      console.error(
        'Ocurrió un error al limpiar las fotografías nuevas:',
        error
      )
    }
  }

  /* 4. Subir las fotografías nuevas al almacenamiento. */

  try {
    for (const archivo of archivos) {
      const nombreSeguro = archivo.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-')

      const ruta = `${producto.id}/${crypto.randomUUID()}-${nombreSeguro}`

      const { error } = await supabase.storage
        .from('prendas')
        .upload(ruta, archivo, {
          contentType: archivo.type,
          upsert: false
        })

      if (error) {
        throw new Error(
          `No se pudo subir la fotografía "${archivo.name}": ${error.message}`
        )
      }

      nuevasFotos.push({
        storage_path: ruta
      })
    }
  } catch (error) {
    await limpiarFotosNuevas()
    throw error
  }

  /* 5. Preparar las variantes.
     El precio pertenece a la prenda, no a cada combinación. */

  const filasVariantes = producto.variantes.map(variante => {
    const color = colores.find(
      item =>
        item.nombre.toLocaleLowerCase() === variante.color.toLocaleLowerCase()
    )

    const stock =
      typeof variante.stock !== 'number'
        ? null
        : Number.isFinite(variante.stock) && variante.stock >= 0
        ? Math.floor(variante.stock)
        : 0

    return {
      id: variante.id,
      color_nombre: variante.color,
      color_codigo: variante.colorCodigo ?? color?.codigo ?? '#929292',
      talle: variante.talle,
      stock
    }
  })

  /* 6. Ejecutar la transacción de Supabase.
     Los datos, variantes y referencias de fotografías se guardan
     en una sola transacción de la base de datos. */

  let rutasFotosEliminadas: string[] = []

  try {
    const { data, error } = await supabase.rpc('guardar_producto_completo', {
      p_producto: {
        id: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        categoria: producto.categoria,
        precio: producto.precio,
        estado: producto.estado
      },

      p_variantes: filasVariantes,

      p_fotos_conservar_ids: fotosConservar.map(foto => foto.id),

      p_fotos_nuevas: nuevasFotos.map((foto, indice) => ({
        storage_path: foto.storage_path,
        texto_alternativo: producto.nombre,
        orden: fotosConservar.length + indice
      }))
    })

    if (error) {
      throw new Error(
        `No se pudo guardar la prenda y sus variantes: ${error.message}`
      )
    }

    rutasFotosEliminadas = data ?? []
  } catch (error) {
    await limpiarFotosNuevas()

    if (error instanceof Error) {
      throw error
    }

    throw new Error(
      'No se pudo completar el guardado de la prenda. Revisá la conexión e intentá nuevamente.'
    )
  }

  /* 7. Después de confirmar la transacción, eliminar del
     almacenamiento las fotografías que ya no se utilizan. */

  if (rutasFotosEliminadas.length > 0) {
    try {
      const { error } = await supabase.storage
        .from('prendas')
        .remove(rutasFotosEliminadas)

      if (error) {
        console.error(
          'La prenda se guardó, pero algunas fotografías antiguas quedaron en Storage:',
          error.message
        )
      }
    } catch (error) {
      console.error(
        'La prenda se guardó, pero no se pudieron eliminar algunas fotografías antiguas:',
        error
      )
    }
  }
}

/* =========================================================
   ACTUALIZAR EL ESTADO DE UNA PRENDA
   ========================================================= */

export async function actualizarEstadoSupabase (
  id: string,
  estado: 'borrador' | 'publicado' | 'oculto'
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('products')
    .update({ estado })
    .eq('id', id)

  if (error) {
    throw new Error(`No se pudo actualizar el estado: ${error.message}`)
  }
}

/* =========================================================
   ELIMINAR UNA PRENDA
   ========================================================= */

export async function eliminarProductoSupabase (id: string): Promise<void> {
  const supabase = createClient()

  /* 1. Recuperar las rutas de las fotografías. */

  const { data: fotos, error: errorFotos } = await supabase
    .from('product_images')
    .select('storage_path')
    .eq('product_id', id)

  if (errorFotos) {
    throw new Error(
      `No se pudieron consultar las fotografías: ${errorFotos.message}`
    )
  }

  /* 2. Eliminar la prenda.
     Las variantes y referencias se eliminan según las relaciones
     configuradas en la base de datos. */

  const { error: errorProducto } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (errorProducto) {
    throw new Error(`No se pudo eliminar la prenda: ${errorProducto.message}`)
  }

  /* 3. Eliminar los archivos del almacenamiento. */

  const rutas = (fotos ?? []).map(foto => foto.storage_path)

  if (rutas.length > 0) {
    try {
      const { error: errorAlmacenamiento } = await supabase.storage
        .from('prendas')
        .remove(rutas)

      if (errorAlmacenamiento) {
        console.error(
          'La prenda se eliminó, pero algunas fotografías quedaron en Storage:',
          errorAlmacenamiento.message
        )
      }
    } catch (error) {
      console.error(
        'La prenda se eliminó, pero no se pudieron eliminar algunas fotografías:',
        error
      )
    }
  }
}
