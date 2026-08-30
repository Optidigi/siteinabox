"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useForm, type FieldErrors, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { IframeEditorSelection } from "@siteinabox/contracts/iframe-editor"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { localizePageEditorSaveError } from "@/lib/editor/localizePageEditorSaveError"
import { EDITOR_DESKTOP_BREAKPOINT } from "@/lib/editor/constants"
import { blockWireId } from "@/lib/editor/ensureBlockIds"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import {
  aggregatePageEditorDirty,
  buildPageDraftKey,
  countPageEditorDirtyLeaves,
  createPageEditorSchema,
  deriveNavDirty,
  deriveThemeDirty,
  editorAppendBlock,
  editorCloneBlockAt,
  editorInsertBlockAt,
  editorRemoveBlock,
  editorReorderBlocks,
  isPageDraftStaleAgainstServer,
  normalizeWatchedBlocks,
  pageEditorDefaultValues,
  pageEditorHasRecoverableDraftWork,
  seedThemeState,
  selectElementPath,
  type PageEditorFormValues,
} from "@/lib/editor/pageEditorCore"
import {
  deletePageEditorDraft,
  readPageEditorDraft,
  writePageEditorDraft,
  type PageEditorDraft,
} from "@/lib/editor/pageDraftStore"
import { elementPathToIframeSelection, iframeSelectionToElementPath } from "@/lib/editor/elementPathBridge"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import type { ElementPath } from "@/components/editor/elementPath"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"
import type { SaveStatus } from "@/components/save-ui/save-status-bar"
import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"
import { canonicalizeCtaFields } from "@/lib/projection/canonicalizeCtaFields"
import { scrollToFirstError } from "@/lib/formScroll"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"
import type { Page } from "@/payload-types"
import type { PageEditorSaveRequest } from "@/lib/publish/pageEditorSaveContract"

const pageEditorThemeCache = new Map<string, ThemeTokens | null>()

export function useIsDesktopEditor(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_DESKTOP_BREAKPOINT}px)`)
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return isDesktop
}

export type PageEditorSaveResult = {
  page: { id: string | number; slug?: string | null; updatedAt?: string } | null
  theme?: ThemeTokens
}

export type UsePageEditorCoreOptions = {
  initial?: Page
  tenantId: number | string
  baseHref: string
  manifest: RtManifest
  theme?: ThemeTokens | null
  canManageNav?: boolean
  inNavbarNav?: boolean
  inFooterNav?: boolean
  readOnly?: boolean
  t: (key: string) => string
  onDraftRestoreFailed: () => void
  onDraftRestored: () => void
  onDraftDiscarded: () => void
  onSaveFailed: (message: string) => void
  onSaveSuccess: (result: {
    savedValues: PageEditorFormValues
    createdPage: PageEditorSaveResult["page"]
    initial?: Page
  }) => void | Promise<void>
}

export type PageEditorCoreApi = {
  form: ReturnType<typeof useForm<PageEditorFormValues>>
  schema: ReturnType<typeof createPageEditorSchema>
  isDesktop: boolean | null
  selected: ElementPath | null
  revealInspectorSelection: boolean
  revealFrameSelection: boolean
  selectElement: Dispatch<SetStateAction<ElementPath | null>>
  selectInspectorElement: (selection: ElementPath) => void
  mobileFocusedSectionIndex: number | null
  setMobileFocusedSectionIndex: Dispatch<SetStateAction<number | null>>
  themeState: ThemeTokens | null
  setThemeState: Dispatch<SetStateAction<ThemeTokens | null>>
  themeDirty: boolean
  inNavbar: boolean
  inFooter: boolean
  navDirty: boolean
  toggleNav: (zone: "navbar" | "footer", next: boolean) => void
  isDirty: boolean
  dirtyCount: number
  errorCount: number
  saveStatus: SaveStatus
  pending: boolean
  submitError: string | null
  setShowSaved: Dispatch<SetStateAction<boolean>>
  watchedBlocks: EditorBlock[]
  reorderBlocks: (from: number, to: number) => void
  deleteBlock: (i: number) => void
  duplicateBlock: (i: number) => void
  addBlock: (blockType: string, seed?: Record<string, unknown>) => void
  insertBlockAtIndex: (index: number, block: Record<string, unknown>) => void
  insertMobileBlockAt: (index: number, blockType: string, seed?: Record<string, unknown>) => void
  mobileFrameBlocksApi: {
    blocks: EditorBlock[]
    reorderBlocks: (from: number, to: number) => void
    insertBlockAt: (index: number, blockType: string, seed?: Record<string, unknown>) => void
    deleteBlock: (i: number) => void
    duplicateBlock: (i: number) => void
  }
  draftCandidate: PageEditorDraft | null
  restorePageDraft: () => void
  discardPageDraft: () => void
  guard: ReturnType<typeof useNavigationGuard>
  triggerSave: () => void
  retry: () => void
  jumpToError: () => void
  onSubmit: (values: PageEditorFormValues) => Promise<void>
  onInvalid: (errors: FieldErrors<PageEditorFormValues>) => void
  handleFrameSelectionChanged: (selection: IframeEditorSelection | null) => void
  frameSelection: IframeEditorSelection | null
  frameMobileMode:
    | {
        mode: "focusedSection"
        focusedBlockIndex: number
        focusedBlockId?: string
        showChrome: false
      }
    | undefined
  cancelScheduledDraftWrite: () => void
  setThemeBaseline: Dispatch<SetStateAction<ThemeTokens | null>>
  setSavedNav: (snapshot: { inNavbar: boolean; inFooter: boolean }) => void
  canEditPage: boolean
  canManageNavResolved: boolean
  pageDraftKey: string
}

export function usePageEditorCore(options: UsePageEditorCoreOptions): PageEditorCoreApi {
  const {
    initial,
    tenantId,
    baseHref,
    manifest,
    theme,
    canManageNav,
    inNavbarNav,
    inFooterNav,
    readOnly = false,
    t,
    onDraftRestoreFailed,
    onDraftRestored,
    onDraftDiscarded,
    onSaveFailed,
    onSaveSuccess,
  } = options

  const schema = useMemo(() => createPageEditorSchema(t), [t])
  const canEditPage = !readOnly
  const canManageNavResolved = canEditPage && !!canManageNav

  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [draftCandidate, setDraftCandidate] = useState<PageEditorDraft | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const draftCandidateRef = useRef<PageEditorDraft | null>(null)
  const draftWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [inNavbar, setInNavbar] = useState(!!inNavbarNav)
  const [inFooter, setInFooter] = useState(!!inFooterNav)
  const [savedInNavbar, setSavedInNavbar] = useState(!!inNavbarNav)
  const [savedInFooter, setSavedInFooter] = useState(!!inFooterNav)
  const navDirty = deriveNavDirty(inNavbar, inFooter, savedInNavbar, savedInFooter, !!initial)

  const tenantStyleCacheKey = String(tenantId)
  const cachedTheme = pageEditorThemeCache.get(tenantStyleCacheKey)
  const [themeState, setThemeState] = useState<ThemeTokens | null>(() =>
    seedThemeState(theme, cachedTheme),
  )
  const [themeBaseline, setThemeBaseline] = useState<ThemeTokens | null>(() =>
    seedThemeState(theme, cachedTheme),
  )
  const themeDirty = useMemo(
    () => deriveThemeDirty(themeState, themeBaseline),
    [themeState, themeBaseline],
  )

  useEffect(() => {
    if (theme == null) return
    pageEditorThemeCache.set(tenantStyleCacheKey, normalizeThemeForSave(theme))
  }, [tenantStyleCacheKey, theme])

  const [selected, setSelected] = useState<ElementPath | null>(null)
  const [revealInspectorSelection, setRevealInspectorSelection] = useState(false)
  const [revealFrameSelection, setRevealFrameSelection] = useState(false)
  const [mobileFocusedSectionIndex, setMobileFocusedSectionIndex] = useState<number | null>(null)

  const selectElement = useCallback<Dispatch<SetStateAction<ElementPath | null>>>((next) => {
    setRevealInspectorSelection(true)
    setRevealFrameSelection(true)
    setSelected((current) => {
      const resolved = selectElementPath(readOnly, current, next)
      if (!resolved) return current
      return resolved.selection
    })
  }, [readOnly])

  const selectInspectorElement = useCallback((selection: ElementPath) => {
    if (readOnly) return
    setRevealInspectorSelection(false)
    setRevealFrameSelection(false)
    setSelected(selection)
  }, [readOnly])

  const isDesktop = useIsDesktopEditor()

  const form = useForm<PageEditorFormValues>({
    resolver: zodResolver(schema) as Resolver<PageEditorFormValues>,
    defaultValues: pageEditorDefaultValues(initial),
  })

  const pageDraftKey = useMemo(
    () => buildPageDraftKey(tenantId, initial, baseHref),
    [tenantId, initial, baseHref],
  )
  const baselineUpdatedAt = initial?.updatedAt ?? null
  const baselineUpdatedAtRef = useRef<string | null>(baselineUpdatedAt)
  const themeStateRef = useRef<ThemeTokens | null>(themeState)
  const themeDirtyRef = useRef(themeDirty)
  const navDirtyRef = useRef(navDirty)
  const navStateRef = useRef({ inNavbar, inFooter })

  useEffect(() => {
    baselineUpdatedAtRef.current = baselineUpdatedAt
  }, [baselineUpdatedAt])
  useEffect(() => {
    themeStateRef.current = themeState
  }, [themeState])
  useEffect(() => {
    themeDirtyRef.current = themeDirty
  }, [themeDirty])
  useEffect(() => {
    navDirtyRef.current = navDirty
  }, [navDirty])
  useEffect(() => {
    navStateRef.current = { inNavbar, inFooter }
  }, [inNavbar, inFooter])
  useEffect(() => {
    draftCandidateRef.current = draftCandidate
  }, [draftCandidate])

  useEffect(() => {
    if (readOnly) {
      setDraftChecked(true)
      return
    }
    let cancelled = false
    setDraftChecked(false)
    void readPageEditorDraft(pageDraftKey).then((draft) => {
      if (cancelled || !draft) return
      const parsed = schema.safeParse(draft.formValues)
      if (!parsed.success || isPageDraftStaleAgainstServer(draft, baselineUpdatedAt)) {
        void deletePageEditorDraft(pageDraftKey)
        return
      }
      setDraftCandidate(draft)
    }).finally(() => {
      if (!cancelled) setDraftChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [readOnly, pageDraftKey, baselineUpdatedAt, schema])

  const cancelScheduledDraftWrite = useCallback(() => {
    if (!draftWriteTimer.current) return
    clearTimeout(draftWriteTimer.current)
    draftWriteTimer.current = null
  }, [])

  const scheduleDraftWrite = useCallback(
    (force = false) => {
      if (readOnly) return
      if (draftWriteTimer.current) clearTimeout(draftWriteTimer.current)
      draftWriteTimer.current = setTimeout(() => {
        if (draftCandidateRef.current) return
        const hasWork =
          force ||
          form.formState.isDirty ||
          themeDirtyRef.current ||
          navDirtyRef.current
        if (!hasWork) {
          void deletePageEditorDraft(pageDraftKey)
          return
        }
        void writePageEditorDraft({
          version: 1,
          key: pageDraftKey,
          savedAt: Date.now(),
          baselineUpdatedAt: baselineUpdatedAtRef.current,
          formValues: form.getValues(),
          theme: themeStateRef.current,
          nav: navStateRef.current,
        })
      }, 350)
    },
    [form, pageDraftKey, readOnly],
  )

  useEffect(() => {
    const subscription = form.watch(() => {
      setShowSaved(false)
      scheduleDraftWrite()
    })
    return () => {
      subscription.unsubscribe()
      cancelScheduledDraftWrite()
    }
  }, [cancelScheduledDraftWrite, form, scheduleDraftWrite])

  useEffect(() => {
    if (themeDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [themeDirty, themeState, scheduleDraftWrite])

  useEffect(() => {
    if (navDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [navDirty, inNavbar, inFooter, scheduleDraftWrite])

  useEffect(() => {
    if (!draftChecked || draftCandidate) return
    if (
      !pageEditorHasRecoverableDraftWork(
        form.formState.isDirty,
        themeDirty,
        navDirty,
      )
    ) {
      void deletePageEditorDraft(pageDraftKey)
    }
  }, [draftChecked, draftCandidate, form.formState.isDirty, themeDirty, navDirty, pageDraftKey])

  const restorePageDraft = useCallback(() => {
    const draft = draftCandidate
    if (!draft) return
    const parsed = schema.safeParse(draft.formValues)
    if (!parsed.success) {
      void deletePageEditorDraft(pageDraftKey)
      setDraftCandidate(null)
      onDraftRestoreFailed()
      return
    }
    setDraftCandidate(null)
    form.reset(parsed.data, { keepDefaultValues: true })
    setThemeState((draft.theme ?? null) as ThemeTokens | null)
    if (draft.nav) {
      setInNavbar(!!draft.nav.inNavbar)
      setInFooter(!!draft.nav.inFooter)
    }
    onDraftRestored()
  }, [
    draftCandidate,
    form,
    onDraftRestoreFailed,
    onDraftRestored,
    pageDraftKey,
  ])

  const discardPageDraft = useCallback(() => {
    setDraftCandidate(null)
    void deletePageEditorDraft(pageDraftKey)
    onDraftDiscarded()
  }, [onDraftDiscarded, pageDraftKey])

  const toggleNav = useCallback(
    (zone: "navbar" | "footer", next: boolean) => {
      if (!canEditPage || !initial) return
      const setLocal = zone === "navbar" ? setInNavbar : setInFooter
      setLocal(next)
    },
    [canEditPage, initial],
  )

  const setSavedNav = useCallback((snapshot: { inNavbar: boolean; inFooter: boolean }) => {
    setSavedInNavbar(snapshot.inNavbar)
    setSavedInFooter(snapshot.inFooter)
  }, [])

  const dirtyInputs = useMemo(
    () => ({
      readOnly,
      formDirty: form.formState.isDirty,
      themeDirty,
      navDirty,
      dirtyFields: form.formState.dirtyFields,
    }),
    [readOnly, form.formState.isDirty, form.formState.dirtyFields, themeDirty, navDirty],
  )
  const isDirty = aggregatePageEditorDirty(dirtyInputs)
  const errorCount = countLeafErrors(form.formState.errors)
  const dirtyCount = countPageEditorDirtyLeaves(dirtyInputs)

  const guard = useNavigationGuard(!readOnly && (isDirty || pending))

  const onSubmit = async (values: PageEditorFormValues) => {
    if (readOnly) return
    const savedValues: PageEditorFormValues = { ...values, status: "published" }
    const saveStartedAt = performance.now()
    setPending(true)
    setSubmitError(null)
    setShowSaved(false)
    const themeWasDirty = themeDirty
    const themeSnapshot = themeState
    const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)
    const navWasDirty = navDirty
    const navSnapshot = { inNavbar, inFooter }
    const normalizedBlocks = normalizePageBlockUploadIds(savedValues.blocks)
    const pageData = {
      ...savedValues,
      tenant: tenantId,
      blocks: Array.isArray(normalizedBlocks)
        ? normalizedBlocks.map((block) => canonicalizeCtaFields(block as Record<string, unknown>))
        : [],
      seo: savedValues.seo
        ? { ...savedValues.seo, ogImage: normalizeUploadId(savedValues.seo.ogImage) }
        : savedValues.seo,
    }
    let createdPage: PageEditorSaveResult["page"] = null
    const siteDesign: NonNullable<PageEditorSaveRequest["siteDesign"]> = {}
    if (themeWasDirty && normalizedThemeSnapshot) siteDesign.theme = normalizedThemeSnapshot
    if (navWasDirty) siteDesign.navigation = navSnapshot
    const saveBody: PageEditorSaveRequest = {
      tenantId,
      publish: true,
      page: {
        id: initial?.id,
        data: pageData,
        ...(baselineUpdatedAtRef.current
          ? { expectedUpdatedAt: baselineUpdatedAtRef.current }
          : {}),
      },
      ...(Object.keys(siteDesign).length > 0 ? { siteDesign } : {}),
    }
    try {
      const response = await fetch("/api/page-editor-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status === 409 && typeof result?.message === "string") {
          throw new Error(localizePageEditorSaveError(result.message, t))
        }
        const message = typeof result?.message === "string" ? result.message : `HTTP ${response.status}`
        throw new Error(localizePageEditorSaveError(message, t))
      }
      createdPage = result?.page?.id == null ? null : result.page
      if (typeof result?.page?.updatedAt === "string") {
        baselineUpdatedAtRef.current = result.page.updatedAt
      }
      if (themeWasDirty && normalizedThemeSnapshot) {
        const savedTheme = (result?.theme ?? normalizedThemeSnapshot) as ThemeTokens
        setThemeState(savedTheme)
        setThemeBaseline(savedTheme)
        pageEditorThemeCache.set(tenantStyleCacheKey, savedTheme)
      }
      if (navWasDirty) {
        setSavedNav(navSnapshot)
      }
    } catch (err) {
      setPending(false)
      const msg = err instanceof Error
        ? localizePageEditorSaveError(err.message, t)
        : t("saveFailed")
      setSubmitError(msg)
      onSaveFailed(msg)
      captureCmsBrowserEvent({
        event: "cms_page_save_failed",
        cms_route: initial ? "/pages/[id]" : "/pages/new",
        cms_action: "page-save",
        cms_result: "failure",
        cms_object_type: "page",
        cms_object_id: initial?.id ?? createdPage?.id ?? undefined,
        cms_error_type: msg.split(":", 1)[0] || "save",
        cms_dirty_count: dirtyCount,
        cms_duration_ms: performance.now() - saveStartedAt,
      })
      return
    }
    setPending(false)
    setSubmitError(null)
    form.reset(savedValues)
    cancelScheduledDraftWrite()
    setShowSaved(true)
    captureCmsBrowserEvent({
      event: "cms_page_saved",
      cms_route: initial ? "/pages/[id]" : "/pages/new",
      cms_action: "page-save",
      cms_result: "success",
      cms_object_type: "page",
      cms_object_id: initial?.id ?? createdPage?.id ?? undefined,
      cms_dirty_count: dirtyCount,
      cms_duration_ms: performance.now() - saveStartedAt,
    })
    await deletePageEditorDraft(pageDraftKey)
    await onSaveSuccess({ savedValues, createdPage, initial })
  }

  const onInvalid = (errors: FieldErrors<PageEditorFormValues>) => {
    scrollToFirstError(errors as Record<string, unknown>)
    captureCmsBrowserEvent({
      event: "cms_page_save_failed",
      cms_route: initial ? "/pages/[id]" : "/pages/new",
      cms_action: "page-save",
      cms_result: "failure",
      cms_object_type: "page",
      cms_object_id: initial?.id,
      cms_error_type: "client-validation",
      cms_dirty_count: dirtyCount,
    })
  }

  const retry = () => form.handleSubmit(onSubmit, onInvalid)()
  const triggerSave = useCallback(() => {
    if (readOnly) return
    form.handleSubmit(onSubmit, onInvalid)()
  }, [form, onInvalid, onSubmit, readOnly])

  const jumpToError = () =>
    scrollToFirstError(form.formState.errors as Record<string, unknown>)

  const saveStatus: SaveStatus = deriveSaveStatus({
    pending,
    hasError: errorCount > 0 || !!submitError,
    isDirty,
    showSaved,
  })

  const watchedBlocks: EditorBlock[] = form.watch("blocks") ?? []

  useEffect(() => {
    if (readOnly) return
    const normalized = normalizeWatchedBlocks(watchedBlocks)
    if (normalized) {
      form.setValue("blocks", normalized, { shouldDirty: false })
    }
  }, [form, readOnly, watchedBlocks])

  const applyBlocks = useCallback(
    (blocks: EditorBlock[], selection: ElementPath | null) => {
      form.setValue("blocks", blocks, { shouldDirty: true })
      setRevealInspectorSelection(true)
      setSelected(selection)
    },
    [form],
  )

  const reorderBlocks = (from: number, to: number) => {
    if (readOnly) return
    const result = editorReorderBlocks(watchedBlocks, selected, from, to)
    applyBlocks(result.blocks, result.selection)
  }

  const deleteBlock = (i: number) => {
    if (readOnly) return
    const result = editorRemoveBlock(watchedBlocks, selected, i)
    applyBlocks(result.blocks, result.selection)
  }

  const duplicateBlock = (i: number) => {
    if (readOnly) return
    const result = editorCloneBlockAt(watchedBlocks, selected, i)
    if (!result) return
    applyBlocks(result.blocks, result.selection)
  }

  const insertBlockAtIndex = useCallback(
    (index: number, block: Record<string, unknown>) => {
      if (readOnly) return
      const blockType = typeof block.blockType === "string" ? block.blockType : ""
      if (!blockType) return
      const result = editorInsertBlockAt(watchedBlocks, index, { ...block, blockType })
      applyBlocks(result.blocks, result.selection)
    },
    [applyBlocks, readOnly, watchedBlocks],
  )

  const addBlock = (blockType: string, seed?: Record<string, unknown>) => {
    if (readOnly) return
    const defaultAnchor = manifest?.blocks?.find((m) => m.slug === blockType)?.defaultAnchor
    const result = editorAppendBlock(watchedBlocks, {
      blockType,
      ...(defaultAnchor ? { anchor: defaultAnchor } : {}),
      ...seed,
    })
    applyBlocks(result.blocks, result.selection)
  }

  const insertMobileBlockAt = useCallback(
    (index: number, blockType: string, seed?: Record<string, unknown>) => {
      if (readOnly) return
      const defaultAnchor = manifest?.blocks?.find((m) => m.slug === blockType)?.defaultAnchor
      insertBlockAtIndex(index, {
        blockType,
        ...(defaultAnchor ? { anchor: defaultAnchor } : {}),
        ...seed,
      })
    },
    [insertBlockAtIndex, manifest?.blocks, readOnly],
  )

  const mobileFrameBlocksApi = useMemo(
    () => ({
      blocks: watchedBlocks,
      reorderBlocks,
      insertBlockAt: insertMobileBlockAt,
      deleteBlock,
      duplicateBlock,
    }),
    [deleteBlock, duplicateBlock, insertMobileBlockAt, reorderBlocks, watchedBlocks],
  )

  useEffect(() => {
    if (mobileFocusedSectionIndex == null) return
    if (watchedBlocks[mobileFocusedSectionIndex]) return
    setMobileFocusedSectionIndex(null)
  }, [mobileFocusedSectionIndex, watchedBlocks])

  const framePageId = initial?.id ?? "new"
  const frameSelection = useMemo((): IframeEditorSelection | null => {
    return elementPathToIframeSelection(selected, watchedBlocks, framePageId)
  }, [framePageId, selected, watchedBlocks])
  const frameMobileMode = useMemo(() => {
    // Unresolved breakpoint (null) and desktop must not prepare a focused mobile iframe.
    if (isDesktop !== false || mobileFocusedSectionIndex == null) return undefined
    const focusedBlock = watchedBlocks[mobileFocusedSectionIndex]
    const focusedBlockId =
      focusedBlock && typeof focusedBlock === "object"
        ? (blockWireId(focusedBlock as Record<string, unknown>) ?? undefined)
        : undefined
    return {
      mode: "focusedSection" as const,
      focusedBlockIndex: mobileFocusedSectionIndex,
      ...(focusedBlockId ? { focusedBlockId } : {}),
      showChrome: false as const,
    }
  }, [isDesktop, mobileFocusedSectionIndex, watchedBlocks])

  const handleFrameSelectionChanged = useCallback(
    (selection: IframeEditorSelection | null) => {
      if (readOnly) return
      setRevealInspectorSelection(false)
      setRevealFrameSelection(false)
      if (!selection) {
        setSelected(null)
        return
      }
      const path = iframeSelectionToElementPath(selection, watchedBlocks)
      if (!path) return
      setSelected(path)
    },
    [readOnly, watchedBlocks],
  )

  return {
    form,
    schema,
    isDesktop,
    selected,
    revealInspectorSelection,
    revealFrameSelection,
    selectElement,
    selectInspectorElement,
    mobileFocusedSectionIndex,
    setMobileFocusedSectionIndex,
    themeState,
    setThemeState,
    themeDirty,
    inNavbar,
    inFooter,
    navDirty,
    toggleNav,
    isDirty,
    dirtyCount,
    errorCount,
    saveStatus,
    pending,
    submitError,
    setShowSaved,
    watchedBlocks,
    reorderBlocks,
    deleteBlock,
    duplicateBlock,
    addBlock,
    insertBlockAtIndex,
    insertMobileBlockAt,
    mobileFrameBlocksApi,
    draftCandidate,
    restorePageDraft,
    discardPageDraft,
    guard,
    triggerSave,
    retry,
    jumpToError,
    onSubmit,
    onInvalid,
    handleFrameSelectionChanged,
    frameSelection,
    frameMobileMode,
    cancelScheduledDraftWrite,
    setThemeBaseline,
    setSavedNav,
    canEditPage,
    canManageNavResolved,
    pageDraftKey,
  }
}
