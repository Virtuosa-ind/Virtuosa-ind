import { createClient } from '@/lib/supabase/client'

export type OpcionColor = {
  nombre: string
  codigo: string
}

export type VarianteTienda = {
  id: string
  color: string
  colorCodigo: string
  talle: string
  stock: number | null
}

export type ProductoTienda = {
  id: string
  nombre: string
  categoria: string
  precio: number
  imagen: string
  descripcion?: string
  talles: string[]
  colores: OpcionColor[]
  variantes: VarianteTienda[]
}

type ProductoDB = {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  precio: number | string
  created_at: string
}

type VarianteDB = {
  id: string
  product_id: string
  color_nombre: string
  color_codigo: string
  talle: string
  stock: number | null
  precio: number | string | null
}

type FotoDB = {
  product_id: string
  storage_path: string
  orden: number
}

export async function obtenerCatalogoPublicado (): Promise<ProductoTienda[]> {
  const supabase = createClient()

  const { data: filasProductos, error: errorProductos } = await supabase
    .from('products')
    .select('id, nombre, descripcion, categoria, precio, created_at')
    .eq('estado', 'publicado')
    .order('created_at', { ascending: false })

  if (errorProductos) {
    throw new Error(`No se pudo cargar el catálogo: ${errorProductos.message}`)
  }

  const productosDB = (filasProductos ?? []) as ProductoDB[]

  if (productosDB.length === 0) {
    return []
  }

  const ids = productosDB.map(producto => producto.id)

  const [resultadoVariantes, resultadoFotos] = await Promise.all([
    supabase
      .from('product_variants')
      .select(
        'id, product_id, color_nombre, color_codigo, talle, stock, precio'
      )
      .in('product_id', ids),

    supabase
      .from('product_images')
      .select('product_id, storage_path, orden')
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
      `No se pudieron cargar las fotos: ${resultadoFotos.error.message}`
    )
  }

  const variantesDB = (resultadoVariantes.data ?? []) as VarianteDB[]
  const fotosDB = (resultadoFotos.data ?? []) as FotoDB[]

  return productosDB.map(producto => {
    const variantesProducto = variantesDB.filter(
      variante => variante.product_id === producto.id
    )

    const fotosProducto = fotosDB
      .filter(foto => foto.product_id === producto.id)
      .map(foto => {
        const { data } = supabase.storage
          .from('prendas')
          .getPublicUrl(foto.storage_path)

        return data.publicUrl
      })

    const coloresProducto: OpcionColor[] = []

    for (const variante of variantesProducto) {
      if (
        !coloresProducto.some(color => color.nombre === variante.color_nombre)
      ) {
        coloresProducto.push({
          nombre: variante.color_nombre,
          codigo: variante.color_codigo
        })
      }
    }

    const tallesProducto = [
      ...new Set(variantesProducto.map(variante => variante.talle))
    ]

    return {
      id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio: Number(producto.precio),
      imagen: fotosProducto[0] ?? '',
      descripcion: producto.descripcion ?? '',
      talles: tallesProducto,
      colores: coloresProducto,

      variantes: variantesProducto.map(variante => ({
        id: variante.id,
        color: variante.color_nombre,
        colorCodigo: variante.color_codigo,
        talle: variante.talle,
        stock: variante.stock
      }))
    }
  })
}
