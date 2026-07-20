"use client"

import { useCallback } from "react"
import { useFormContext } from "react-hook-form"
import type { ElementPath } from "@/components/editor/elementPath"
import {
  appendArrayItem,
  getArrayItems,
  removeArrayItem,
  reorderArrayItems,
  updateArrayItem,
  updateArrayItemField,
} from "@/lib/editor/arrayItemOps"
import {
  blockFieldName,
  elementPathFieldName,
  type BlockFieldPath,
} from "@/lib/editor/blockFieldPath"
import type { EditorArrayItem } from "@/lib/editor/blockFieldValues"

export type BlockFieldSetValue = (next: unknown) => void

export type BlockFieldController = {
  name: string
  value: unknown
  setValue: BlockFieldSetValue
}

export type BlockArrayFieldController<T extends EditorArrayItem = EditorArrayItem> = {
  name: string
  items: T[]
  setItems: (next: T[]) => void
  updateItem: (itemIndex: number, next: T) => void
  updateItemField: (itemIndex: number, field: string, value: unknown) => void
  removeItem: (itemIndex: number) => void
  reorderItems: (from: number, to: number) => void
  appendItem: (seed?: Partial<T>) => { items: T[]; insertedIndex: number }
}

const dirtySetValueOptions = { shouldDirty: true } as const

export function useBlockFieldController(path: BlockFieldPath): BlockFieldController {
  const { watch, setValue } = useFormContext()
  const name = blockFieldName(path)
  const value = watch(name)
  const setFieldValue = useCallback<BlockFieldSetValue>(
    (next) => setValue(name, next, dirtySetValueOptions),
    [name, setValue],
  )
  return { name, value, setValue: setFieldValue }
}

export function useElementPathFieldController(path: ElementPath): BlockFieldController {
  const { watch, setValue } = useFormContext()
  const name = elementPathFieldName(path)
  const value = watch(name)
  const setFieldValue = useCallback<BlockFieldSetValue>(
    (next) => setValue(name, next, dirtySetValueOptions),
    [name, setValue],
  )
  return { name, value, setValue: setFieldValue }
}

export function useBlockArrayFieldController<T extends EditorArrayItem = EditorArrayItem>(
  path: BlockFieldPath,
): BlockArrayFieldController<T> {
  const { watch, setValue } = useFormContext()
  const name = blockFieldName(path)
  const rawItems = watch(name)
  const items = getArrayItems<T>(rawItems)

  const setItems = useCallback(
    (next: T[]) => setValue(name, next, dirtySetValueOptions),
    [name, setValue],
  )

  const updateItem = useCallback(
    (itemIndex: number, next: T) => setItems(updateArrayItem(items, itemIndex, next)),
    [items, setItems],
  )

  const updateItemField = useCallback(
    (itemIndex: number, field: string, value: unknown) =>
      setItems(updateArrayItemField(items, itemIndex, field, value)),
    [items, setItems],
  )

  const removeItem = useCallback(
    (itemIndex: number) => setItems(removeArrayItem(items, itemIndex)),
    [items, setItems],
  )

  const reorderItems = useCallback(
    (from: number, to: number) => setItems(reorderArrayItems(items, from, to)),
    [items, setItems],
  )

  const appendItem = useCallback(
    (seed: Partial<T> = {}) => {
      const result = appendArrayItem(items, seed)
      setItems(result.items)
      return result
    },
    [items, setItems],
  )

  return {
    name,
    items,
    setItems,
    updateItem,
    updateItemField,
    removeItem,
    reorderItems,
    appendItem,
  }
}