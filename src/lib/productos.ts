export const categorias = [
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
] as const

export type EstadoProducto = 'borrador' | 'publicado' | 'oculto'

export type VarianteProducto = {
  id: string
  color: string
  colorCodigo?: string
  talle: string
  stock: number | null
}

export type Producto = {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  precio: number
  fotos: string[]
  variantes: VarianteProducto[]
  estado: EstadoProducto
  creadoEn: string
  actualizadoEn: string
}

export function productoEstaAgotado (producto: Producto): boolean {
  return (
    producto.variantes.length > 0 &&
    producto.variantes.every(variante => variante.stock === 0)
  )
}

export function varianteEstaAgotada (variante: VarianteProducto): boolean {
  return variante.stock === 0
}
