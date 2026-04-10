import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from './api'
import type { CreateProductPayload, UpdateProductPayload } from './types'

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: listProducts })
}

export function useProduct(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => getProduct(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) =>
      updateProduct(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
