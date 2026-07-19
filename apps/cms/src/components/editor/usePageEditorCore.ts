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
import { EDITOR_DESKTOP_BREAKPOINT } from "@/lib/editor/constants"
import { blockWireId } from "@/lib/editor/ensureBlockIds"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import {
  aggregatePageEditorDirty,
  buildPageDraftKey,
  countPageEditorDirtyLeaves,
  createPageEditorSchema,
  deriveChromeDirty,
  deriveNavDirty,
  deriveThemeDirty,
  editorAppendBlock,
  editorCloneBlockAt,
  editorInsertBlockAt,
  editorRemoveBlock,
  editorReorderBlocks,
  isPageDraftStaleAgainstServer,
  mergeRestoredChromeDraft,
  normalizeWatchedBlocks,
  pageEditorDefaultValues,
  pageEditorHasRecoverableDraftWork,
  seedThemeState,
  selectChromeZone,
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
import type { SiteChromeSelection } from "@/components/editor/sidebar/SiteChromeRow"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"
import type { SaveStatus } from "@/components/save-ui/save-status-bar"
import { resolveFooterContract } from "@/lib/footerComposition"
import { resolveSettingsContract } from "@/lib/settingsContract"
import {
  chromeComparable,
  chromeDraftFromSettings,
  chromePatchFromDraft,
  mergeChromeSettings,
  rendererSettingsFromChromeDraft,
  type SiteChromeDraft,
} from "@/lib/siteChromeDraft"
import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"
import { canonicalizeCtaFields } from "@/lib/projection/canonicalizeCtaFields"
import type { NavPage } from "@/lib/projection/resolveNav"
import { scrollToFirstError } from "@/lib/formScroll"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"
import type { Page } from "@/payload-types"
import type { FooterCompositionContract } from "@/lib/footerComposition"

const pageEditorThemeCache = new Map<string, ThemeTokens | null>()

const settingsRecordId = (settings: unknown): string | number | null => {
  if (settings == null || typeof settings !== "object" || Array.isArray(settings)) return null
  const id = (settings as Record<string, unknown>).id
  return typeof id === "string" || typeof id === "number" ? id : null
}

export function useIsDesktopEditor() {
  const [isDesktop, setIsDesktop] = useState(false)
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
  page: { id: string | number; slug?: string | null } | null
  theme?: ThemeTokens
}

export type UsePageEditorCoreOptions = {
  initial?: Page
  tenantId: number | string
  baseHref: string
  manifest: RtManifest
  theme?: ThemeTokens | null
  siteSettings?: unknown
  rendererNavPages?: NavPage[]
  canManageNav?: boolean
  canEditSettings?: boolean
  inHeaderNav?: boolean
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
  isDesktop: boolean
  selected: ElementPath | null
  selectedChrome: SiteChromeSelection | null
  selectElement: Dispatch<SetStateAction<ElementPath | null>>
  selectChrome: (selection: SiteChromeSelection) => void
  clearChromeSelection: () => void
  mobileFocusedSectionIndex: number | null
  setMobileFocusedSectionIndex: Dispatch<SetStateAction<number | null>>
  themeState: ThemeTokens | null
  setThemeState: Dispatch<SetStateAction<ThemeTokens | null>>
  themeDirty: boolean
  chromeDraft: SiteChromeDraft
  setChromeDraft: Dispatch<SetStateAction<SiteChromeDraft>>
  chromeDirty: boolean
  chromeSettingsState: ReturnType<typeof mergeChromeSettings> | null
  rendererSettingsState: ReturnType<typeof rendererSettingsFromChromeDraft>
  footerContract: FooterCompositionContract | null
  inHeader: boolean
  inFooter: boolean
  navDirty: boolean
  toggleNav: (zone: "header" | "footer", next: boolean) => void
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
  handleFrameChromeSelect: (zone: "header" | "footer") => void
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
  setSavedNav: (snapshot: { inHeader: boolean; inFooter: boolean }) => void
  setChromeBaseline: Dispatch<SetStateAction<SiteChromeDraft>>
  canEditPage: boolean
  canManageNavResolved: boolean
  canEditSettingsResolved: boolean
  pageDraftKey: string
}

export function usePageEditorCore(options: UsePageEditorCoreOptions): PageEditorCoreApi {
  const {
    initial,
    tenantId,
    baseHref,
    manifest,
    theme,
    siteSettings,
    rendererNavPages = [],
    canManageNav,
    canEditSettings,
    inHeaderNav,
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
  const canEditSettingsResolved = canEditPage && !!canEditSettings

  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [draftCandidate, setDraftCandidate] = useState<PageEditorDraft | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const draftCandidateRef = useRef<PageEditorDraft | null>(null)
  const draftWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [inHeader, setInHeader] = useState(!!inHeaderNav)
  const [inFooter, setInFooter] = useState(!!inFooterNav)
  const [savedInHeader, setSavedInHeader] = useState(!!inHeaderNav)
  const [savedInFooter, setSavedInFooter] = useState(!!inFooterNav)
  const navDirty = deriveNavDirty(inHeader, inFooter, savedInHeader, savedInFooter, !!initial)

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
  const [mobileFocusedSectionIndex, setMobileFocusedSectionIndex] = useState<number | null>(null)
  const [selectedChrome, setSelectedChrome] = useState<SiteChromeSelection | null>(null)
  const siteSettingsState = siteSettings ?? null
  const footerContract = useMemo(() => resolveFooterContract(manifest), [manifest])
  const settingsContract = useMemo(() => resolveSettingsContract(manifest), [manifest])
  const [chromeDraft, setChromeDraftState] = useState<SiteChromeDraft>(() =>
    chromeDraftFromSettings(siteSettingsState, footerContract),
  )
  const [chromeBaseline, setChromeBaselineState] = useState<SiteChromeDraft>(() =>
    chromeDraftFromSettings(siteSettingsState, footerContract),
  )
  const chromeDraftRef = useRef<SiteChromeDraft>(chromeDraft)
  const chromeBaselineRef = useRef<SiteChromeDraft>(chromeBaseline)
  const setChromeDraft = useCallback<Dispatch<SetStateAction<SiteChromeDraft>>>((next) => {
    const current = chromeDraftRef.current
    const resolved = typeof next === "function" ? next(current) : next
    chromeDraftRef.current = resolved
    setChromeDraftState(resolved)
  }, [])
  const setChromeBaseline = useCallback<Dispatch<SetStateAction<SiteChromeDraft>>>((next) => {
    const current = chromeBaselineRef.current
    const resolved = typeof next === "function" ? next(current) : next
    chromeBaselineRef.current = resolved
    setChromeBaselineState(resolved)
  }, [])
  const chromeDirty = useMemo(
    () => deriveChromeDirty(chromeDraft, chromeBaseline, footerContract),
    [chromeDraft, chromeBaseline, footerContract],
  )
  const chromeSettingsState = useMemo(
    () => (siteSettingsState ? mergeChromeSettings(siteSettingsState, chromeDraft) : null),
    [siteSettingsState, chromeDraft],
  )
  const rendererSettingsState = useMemo(
    () =>
      rendererSettingsFromChromeDraft(siteSettingsState, chromeDraft, {
        publishedPages: rendererNavPages,
        settingsContract,
      }),
    [chromeDraft, rendererNavPages, settingsContract, siteSettingsState],
  )

  const selectElement = useCallback<Dispatch<SetStateAction<ElementPath | null>>>((next) => {
    setSelected((current) => {
      const resolved = selectElementPath(readOnly, current, next)
      if (!resolved) return current
      setSelectedChrome(resolved.chromeSelection)
      return resolved.selection
    })
  }, [readOnly])

  const selectChrome = useCallback((selection: SiteChromeSelection) => {
    const resolved = selectChromeZone(readOnly, selection)
    if (!resolved) return
    setSelected(resolved.selection)
    setSelectedChrome(resolved.chromeSelection)
  }, [readOnly])

  const clearChromeSelection = useCallback(() => {
    setSelectedChrome(null)
  }, [])

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
  const chromeDirtyRef = useRef(chromeDirty)
  const navStateRef = useRef({ inHeader, inFooter })

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
    chromeDraftRef.current = chromeDraft
  }, [chromeDraft])
  useEffect(() => {
    chromeBaselineRef.current = chromeBaseline
  }, [chromeBaseline])
  useEffect(() => {
    chromeDirtyRef.current = chromeDirty
  }, [chromeDirty])
  useEffect(() => {
    navStateRef.current = { inHeader, inFooter }
  }, [inHeader, inFooter])
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
          navDirtyRef.current ||
          chromeDirtyRef.current
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
          chrome: chromeDraftRef.current,
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
  }, [navDirty, inHeader, inFooter, scheduleDraftWrite])

  useEffect(() => {
    if (chromeDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [chromeDirty, chromeDraft, scheduleDraftWrite])

  useEffect(() => {
    if (!draftChecked || draftCandidate) return
    if (
      !pageEditorHasRecoverableDraftWork(
        form.formState.isDirty,
        themeDirty,
        navDirty,
        chromeDirty,
      )
    ) {
      void deletePageEditorDraft(pageDraftKey)
    }
  }, [draftChecked, draftCandidate, form.formState.isDirty, themeDirty, navDirty, chromeDirty, pageDraftKey])

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
      setInHeader(!!draft.nav.inHeader)
      setInFooter(!!draft.nav.inFooter)
    }
    if (draft.chrome) {
      setChromeDraft(mergeRestoredChromeDraft(siteSettingsState, footerContract, draft.chrome))
    }
    onDraftRestored()
  }, [
    draftCandidate,
    form,
    footerContract,
    onDraftRestoreFailed,
    onDraftRestored,
    pageDraftKey,
    siteSettingsState,
  ])

  const discardPageDraft = useCallback(() => {
    setDraftCandidate(null)
    void deletePageEditorDraft(pageDraftKey)
    onDraftDiscarded()
  }, [onDraftDiscarded, pageDraftKey])

  const toggleNav = useCallback(
    (zone: "header" | "footer", next: boolean) => {
      if (!canEditPage || !initial) return
      const setLocal = zone === "header" ? setInHeader : setInFooter
      setLocal(next)
    },
    [canEditPage, initial],
  )

  const setSavedNav = useCallback((snapshot: { inHeader: boolean; inFooter: boolean }) => {
    setSavedInHeader(snapshot.inHeader)
    setSavedInFooter(snapshot.inFooter)
  }, [])

  const dirtyInputs = useMemo(
    () => ({
      readOnly,
      formDirty: form.formState.isDirty,
      themeDirty,
      navDirty,
      chromeDirty,
      dirtyFields: form.formState.dirtyFields,
    }),
    [readOnly, form.formState.isDirty, form.formState.dirtyFields, themeDirty, navDirty, chromeDirty],
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
    const navSnapshot = { inHeader, inFooter }
    const chromeSnapshot = chromeDraftRef.current
    const chromeWasDirty =
      chromeDirtyRef.current ||
      JSON.stringify(chromeComparable(chromeSnapshot, footerContract)) !==
        JSON.stringify(chromeComparable(chromeBaselineRef.current, footerContract))
    const chromeWillSave =
      chromeWasDirty && settingsRecordId(siteSettingsState) != null && canEditSettingsResolved
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
    try {
      const response = await fetch("/api/page-editor-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          page: { id: initial?.id, data: pageData },
          theme: themeWasDirty ? normalizedThemeSnapshot : undefined,
          navigation: navWasDirty ? navSnapshot : undefined,
          chrome: chromeWillSave
            ? chromePatchFromDraft(chromeSnapshot, footerContract)
            : undefined,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result?.message === "string" ? result.message : `HTTP ${response.status}`
        const stage = typeof result?.stage === "string" ? result.stage : "save"
        throw new Error(`${stage}: ${message}`)
      }
      createdPage = result?.page?.id == null ? null : result.page
      if (themeWasDirty && normalizedThemeSnapshot) {
        const savedTheme = (result?.theme ?? normalizedThemeSnapshot) as ThemeTokens
        setThemeState(savedTheme)
        setThemeBaseline(savedTheme)
        pageEditorThemeCache.set(tenantStyleCacheKey, savedTheme)
      }
      if (navWasDirty) {
        setSavedNav(navSnapshot)
      }
      if (chromeWillSave) setChromeBaseline(chromeSnapshot)
    } catch (err) {
      setPending(false)
      const msg = err instanceof Error ? err.message : t("saveFailed")
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
  const frameSelection = useMemo(
    () => elementPathToIframeSelection(selected, watchedBlocks, framePageId),
    [framePageId, selected, watchedBlocks],
  )
  const frameMobileMode = useMemo(() => {
    if (isDesktop || mobileFocusedSectionIndex == null) return undefined
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
      if (!selection) {
        setSelectedChrome(null)
        setSelected(null)
        return
      }
      const path = iframeSelectionToElementPath(selection, watchedBlocks)
      if (!path) return
      setSelectedChrome(null)
      setSelected(path)
    },
    [readOnly, watchedBlocks],
  )

  const handleFrameChromeSelect = useCallback(
    (zone: "header" | "footer") => {
      selectChrome({ zone })
    },
    [selectChrome],
  )

  return {
    form,
    schema,
    isDesktop,
    selected,
    selectedChrome,
    selectElement,
    selectChrome,
    clearChromeSelection,
    mobileFocusedSectionIndex,
    setMobileFocusedSectionIndex,
    themeState,
    setThemeState,
    themeDirty,
    chromeDraft,
    setChromeDraft,
    chromeDirty,
    chromeSettingsState,
    rendererSettingsState,
    footerContract,
    inHeader,
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
    handleFrameChromeSelect,
    frameSelection,
    frameMobileMode,
    cancelScheduledDraftWrite,
    setThemeBaseline,
    setSavedNav,
    setChromeBaseline,
    canEditPage,
    canManageNavResolved,
    canEditSettingsResolved,
    pageDraftKey,
  }
}
