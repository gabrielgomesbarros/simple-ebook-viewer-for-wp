import './simebv-view.js'
import './simebv-navbar.js'
import './simebv-header.js'
import './simebv-sidebar.js'
import { createTOCView } from '../../vendor/foliate-js/ui/tree.js'
import { Overlayer } from '../../vendor/foliate-js/overlayer.js'
import * as CFI from '../../vendor/foliate-js/epubcfi.js'
import { storageAvailable, isNumeric, pageListOutline } from './simebv-utils.js'
import { transformDoc, convertFontSizePxToRem } from './simebv-transform-ebook.js'
import { searchDialog } from './simebv-search-dialog.js'
import { colorFiltersDialog } from './simebv-filters-dialog.js'
import { metadataDialog, MetadataFormatter } from './simebv-metadata-dialog.js'
import { fontsDialog } from './simebv-fonts-dialog.js'
import { annotationsDialog } from './simebv-annotations-dialog.js'
import { createShowAnnotationDialog } from './simebv-show-annotation-dialog.js'
import { createPageListForAnnotations } from './simebv-page-list.js'
import { Menu } from './simebv-menu.js'
import { createMenuItemsStd, getInitialMenuStatusStd } from './simebv-menu-items.js'
import { ebookFormat } from './simebv-ebook-format.js'
const { __, _x, _n, sprintf } = wp.i18n;

// Import css for the Viewer's container element, as static asset
import '../css/simebv-container.css'
// Import css for the Viewer's UI, as string
import viewerUiCss from '../css/simebv-viewer.css?raw'
// CSS to inject in iframe of reflowable ebooks
export const getCSS = ({ spacing, justify, hyphenate, fontSize, colorScheme, bgColor, forcedColorScheme, fontFamily }) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    :root {
        color-scheme: ${colorScheme} !important;
        font-size: ${fontSize}px;
        background-color: ${bgColor};
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media all and (prefers-color-scheme: dark) {
        a:link {
            color: ${colorScheme.includes('dark') ? 'lightblue' : 'LinkText'};
        }
        ${colorScheme.includes('dark')
          ? 'a:visited { color: VisitedText; }'
          : ''
        }
        ${!colorScheme.includes('dark')
            ? '[epub|type~="se:image.color-depth.black-on-transparent"] { filter: none !important; }'
            : ''
        }
    }
    ${forcedColorScheme.includes('dark')
        ? 'body, body * { color: #ffffff !important; background-color: ' + bgColor + ' !important; border-color: #ffffff !important; }'
        : ''
    }
    ${forcedColorScheme.includes('light')
        ? 'body, body * { color: #000000 !important; background-color: ' + bgColor + ' !important; border-color: #000000 !important; }'
        : ''
    }
    ${fontFamily !== 'auto'
        ? 'body, body * { font-family: ' + fontFamily + ' !important; }'
        : ''
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
    a:focus {
        text-decoration: underline dotted .1em;
    }
`

const percentFormat = new Intl.NumberFormat('en', { style: 'percent' })

export class Reader {
    _root
    _rootDiv
    _bookContainer
    _tocView
    _navBar
    _headerBar
    _sideBar
    _overlay
    _realFullscreen
    _alwaysFullViewport
    _showCloseButton
    _annotationsDialog
    _showAnnotationDialog
    _metadataDialog
    _metadataFormatter
    _colorsFilterDialog
    _searchDialog
    _currentSearch
    _currentSearchQuery
    _currentSearchResult = []
    _currentSearchResultIndex = -1
    _lastReadPage
    // don't save user preferences during page load, but only upon user interaction
    _canSavePreferences = false
    _appliedFilter = {
        activateColorFilter: false,
        invertColorsFilter: 0,
        rotateColorsFilter: 0,
        bgFilterTransparent: true,
        bgColorsFilter: '#FFFFFF',
    }
    style = {
        spacing: 1.4,
        justify: true,
        hyphenate: true,
        fontSize: 1,
        colorScheme: 'light dark',
        bgColor: 'transparent',
        forcedColorScheme: '',
        fontFamily: 'auto',
    }
    annotations = new Map()
    annotationsByValue = new Map()
    pageList = new Map()
    pageListByValue = new Map()
    _showAnnotations
    _showPageDelimiters
    container
    menu
    _openEbookFormat
    _ebookTitle
    _defaultFontSize

    _closeMenus() {
        let focusTo
        if (this._sideBar.isVisible()) {
            this._sideBar.saveLastFocus()
            focusTo = this._headerBar.buttonSideBar
            this._headerBar.buttonSideBar.setAttribute('aria-expanded', 'false')
        }
        this._overlay.classList.remove('simebv-show')
        this._sideBar.hide()
        this.menu.hide()
        if (focusTo) {
            focusTo.focus()
        }
    }

    constructor(container, options) {
        let { menu, navBar, headerBar, sideBar, realFullscreen,
            alwaysFullViewport, showCloseButton, closeViewerCallback
        } = options
        this.container = container ?? document.body
        this._root = this.container.attachShadow({ mode: 'open' })
        this._root.innerHTML = readerMarkup
        this._rootDiv = this._root.querySelector('#simebv-reader-root')
        this._bookContainer = this._root.querySelector('#simebv-book-container')
        this._overlay = this._root.querySelector('#simebv-dimming-overlay')
        this._realFullscreen = !!realFullscreen
        this._alwaysFullViewport = !!alwaysFullViewport
        this._showCloseButton = !!(showCloseButton || alwaysFullViewport)

        const sideBarContainer = this._root.querySelector('#simebv-side-bar')
        if (!sideBar) {
            sideBar = document.createElement('simebv-reader-sidebar')
        }
        sideBar.id = 'simebv-reader-sidebar'
        sideBarContainer.append(sideBar)
        this._sideBar = sideBar

        const headerBarContainer = this._root.querySelector('#simebv-header-bar')
        if (!headerBar) {
            headerBar = document.createElement('simebv-reader-header')
        }
        headerBarContainer.append(headerBar)
        this._headerBar = headerBar

        const navBarContainer = this._root.querySelector('#simebv-nav-bar')
        if (!navBar) {
            navBar = document.createElement('simebv-reader-navbar')
        }
        navBarContainer.append(navBar)
        this._navBar = navBar

        if (!menu) {
            menu = new Menu()
        }
        this.menu = menu
        this.menu.element.classList.add('simebv-menu')
        this._setMenuMaxBlockSize()

        if (this._showCloseButton && typeof closeViewerCallback === 'function') {
            this._headerBar.setAttribute('show-close-button', 'true')
            this._headerBar.addEventListener('close-button', closeViewerCallback)
            if (this._alwaysFullViewport) {
                this._toggleFullViewport()
            }
        }
        this._headerBar.addEventListener('side-bar-button', () => {
            setTimeout(() => {
                if (this._sideBar.isVisible()) {
                    this._closeMenus()
                }
                else {
                    this._overlay.classList.add('simebv-show')
                    this._sideBar.show()
                    this._sideBar.setInitialFocus()
                }
            }, 20)
        })
        this._overlay.addEventListener('click', () => {
            this._closeMenus()
        })
        this._sideBar.addEventListener('side-bar-clicked', () => {
            this._tocView.getCurrentItem()?.focus()
        })
        this._sideBar.addEventListener('side-bar-close', this._closeMenus.bind(this))
        this._root.addEventListener('closeMenu', () => {
            if (!this._sideBar.isVisible()) {
                this._overlay.classList.remove('simebv-show')
            }
        })

        if (screen?.orientation) {
            screen.orientation.addEventListener('change', () => {
                this._setMenuMaxBlockSize()
            })
        }

        this._headerBar.attachMenu(this.menu.element)
        this._headerBar.addEventListener('menu-button', (e) => {
            if (!this.menu.element.classList.contains('simebv-show')) {
                this._canSavePreferences = true
                this.menu.show(this._headerBar.buttonMenu)
                this._overlay.classList.add('simebv-show')
            }
            else {
                this._closeMenus()
            }
        })
        this._headerBar.addEventListener(
            'fullscreen-button',
            realFullscreen ? this._toggleFullScreen.bind(this) : this._toggleFullViewport.bind(this)
        )
        this.container.addEventListener('fullscreenchange', (e) => {
            const detail = {}
            if (document.fullscreenElement) {
                detail.data = 'enter'
                this.container.classList.add('simebv-view-real-fullscreen')
            }
            else {
                detail.data = 'exit'
                this.container.classList.remove('simebv-view-real-fullscreen')
            }
            this._headerBar.dispatchEvent(new CustomEvent('toggle-fullscreen', { detail }))
            this._setMenuMaxBlockSize()
        })

        this.setLocalizedDefaultInterface(this._root)

        this._defaultFontSize = this.getDefaultFontSize()

        document.dispatchEvent(new CustomEvent('simebv-viewer-loaded'))
    }

    get containerHeight() {
        return this.container.getBoundingClientRect().height
    }

    get containerWidth() {
        return this.container.getBoundingClientRect().width
    }

    getDefaultFontSize() {
        const fake = document.createElement('div')
        fake.style.visibility = 'hidden'
        fake.style.position = 'absolute'
        fake.style.fontSize = '1rem'
        this._rootDiv.append(fake)
        const computedFontSize = parseFloat(window.getComputedStyle(fake).fontSize)
        fake.remove()
        return isNaN(computedFontSize) ? 16 : computedFontSize
    }

    async drawAnnotationHandler(e) {
        const { draw, annotation, doc, range } = e.detail
        switch (annotation.type) {
            case 'current-search':
                draw(Overlayer.outline, { color: 'green' })
                break
            case 'calibre-bookmark':
                draw(Overlayer.highlight, { color: annotation.color })
                break
            case 'page-list':
                const fontSize = this._defaultFontSize ?? this.getDefaultFontSize()
                draw(pageListOutline, { color: '#E55330', label: annotation.label, type: annotation.type, fontSize })
                break
            default: {
                const drawingFunc = annotation.shape ?? Overlayer.highlight
                draw(drawingFunc, annotation)
            }
        }
    }

    pageListCreateOverlay(e) {
        const { index } = e.detail
        const list = this.pageList.get(index)
        if (list) {
            for (const page of list) {
                this.view.addAnnotation(page)
            }
        }
    }
    boundPageListCreateOverlay = this.pageListCreateOverlay.bind(this)

    pageListShowAnnotation(e) {
        const annotation = this.pageListByValue.get(e.detail.value)
        if (annotation?.label) {
            this.openShowAnnotationDialog(
                __('Start of page ', 'simple-ebook-viewer') + annotation.label,
                'Page list',
            )
        }
    }
    boundPageListShowAnnotation = this.pageListShowAnnotation.bind(this)

    bookmarksCreateOverlay(e) {
        const { index } = e.detail
        const list = this.annotations.get(index)
        if (list) {
            for (const annotation of list) {
                this.view.addAnnotation(annotation)
            }
        }
    }
    boundBookmarksCreateOverlay = this.bookmarksCreateOverlay.bind(this)

    bookmarksShowAnnotation(e) {
        const annotation = this.annotationsByValue.get(e.detail.value)
        if (annotation?.note) {
            this.openShowAnnotationDialog(annotation.note)
        }
    }
    boundBookmarksShowAnnotation = this.bookmarksShowAnnotation.bind(this)

    openShowAnnotationDialog(note, header) {
        if (!this._showAnnotationDialog) {
            this._showAnnotationDialog = createShowAnnotationDialog()
            this._showAnnotationDialog.element.id = 'simebv-show-annotation-dialog'
            this._showAnnotationDialog.element.classList.add('simebv-form-dialog')
            this._rootDiv.append(this._showAnnotationDialog.element)
        }
        this._showAnnotationDialog.showAnnotation(note, header, this.container)
    }

    _createAnnotationsDialog() {
        if (!this._annotationsDialog) {
            this._annotationsDialog = annotationsDialog(this)
            this._annotationsDialog.id = 'simebv-annotations-dialog'
            this._annotationsDialog.classList.add('simebv-form-dialog')
            this._rootDiv.append(this._annotationsDialog)
        }
    }

    openAnnotationsDialog() {
        if (!this._annotationsDialog) {
            this._createAnnotationsDialog()
        }
        this._annotationsDialog.showModal()
    }

    openMetadataDialog() {
        if (!this._metadataDialog) {
            this._metadataDialog = metadataDialog(this.view?.book?.metadata ?? {}, this._metadataFormatter, this._openEbookFormat)
            this._metadataDialog.id = 'simebv-metadata-dialog'
            this._rootDiv.append(this._metadataDialog)
            this._metadataDialog.style.minWidth = 'min(320px, 100vw)'
        }
        this._metadataDialog.style.maxWidth = 'min(70vw, ' + (this.containerWidth - 30) + 'px)'
        this._metadataDialog.showModal()
    }

    _createFilterDialog(bookContainer, isFixedLayout) {
        if (!this._colorsFilterDialog) {
            this._colorsFilterDialog = colorFiltersDialog(bookContainer, this._appliedFilter, isFixedLayout)
            this._colorsFilterDialog.id = 'simebv-colors-filter-dialog'
            this._rootDiv.append(this._colorsFilterDialog)
            this._colorsFilterDialog.addEventListener('close', () => {
                for (const prop in this._appliedFilter) {
                    this._savePreference(prop, this._appliedFilter[prop])
                }
            })
        }
    }

    openFilterDialog(bookContainer) {
        if (!this._colorsFilterDialog) {
            this._createFilterDialog(bookContainer)
        }
        this._colorsFilterDialog.showModal()
    }

    openFontsDialog() {
        if (!this._fontsDialog) {
            this._fontsDialog = fontsDialog(this, getCSS)
            this._fontsDialog.id = 'simebv-fonts-dialog'
            this._fontsDialog.classList.add('simebv-form-dialog')
            this._rootDiv.append(this._fontsDialog)
        }
        this._fontsDialog.showModal()
    }

    openSearchDialog() {
        if (!this._searchDialog) {
            this._searchDialog = searchDialog(
                this.boundDoSearch,
                this.boundPrevMatch,
                this.boundNextMatch,
                this.boundSearchCleanUp,
                this.container
            )
            this._searchDialog.id = 'simebv-search-dialog'
            this._rootDiv.append(this._searchDialog)
        }
        this._searchDialog.show()
        this._searchDialog.classList.add('simebv-show')
    }

    async doSearch(str, reverse = false) {
        if (this._currentSearch && this._currentSearchQuery === str) {
            reverse ? await this.prevMatch() : await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this._currentSearchQuery = str
        this._currentSearch = await this.view?.search({query: str})
        await this.matchUntilCurrentLocation()
        await this.nextMatch()
    }
    boundDoSearch = this.doSearch.bind(this)

    async matchUntilCurrentLocation() {
        while (true) {
            if (!this._currentSearch) {
                // this can happen if the user closes the search panel during the search
                return
            }
            const result = await this._currentSearch.next()
            if (result.value === 'done' || result.done === true) {
                break
            }
            if (result.value?.subitems) {
                this._currentSearchResult.push(...result.value.subitems)
                let resultCfi = this._currentSearchResult[this._currentSearchResult.length - 1].cfi
                if (CFI.compare(this.view.lastLocation.cfi, resultCfi) > 0) {  // 1: resultCfi precedes this.view.lastLocation.cfi
                    this._currentSearchResultIndex = this._currentSearchResult.length - 1
                    continue
                }
                while (this._currentSearchResultIndex < this._currentSearchResult.length - 1) {
                    this._currentSearchResultIndex++
                    resultCfi = this._currentSearchResult[this._currentSearchResultIndex].cfi
                    if (CFI.compare(this.view.lastLocation.cfi, resultCfi) <= 0) {
                        this._currentSearchResultIndex--
                        return
                    }
                }
            }
        }
        this._currentSearchResultIndex = this._currentSearchResult.length - 2
    }

    async nextMatch() {
        if (!this._currentSearch) {
            return
        }
        if (this._currentSearchResult
                && this._currentSearchResult.length > 0
                && this._currentSearchResultIndex < this._currentSearchResult.length - 1
        ) {
            const oldCFI = this._currentSearchResult[this._currentSearchResultIndex]?.cfi
            if (oldCFI) {
                this.view.deleteAnnotation({value: oldCFI})
            }
            this._currentSearchResultIndex++
            const newCFI = this._currentSearchResult[this._currentSearchResultIndex].cfi
            await this.view.goTo(newCFI)
            this.view.addAnnotation({value: newCFI, type: 'current-search'})
            return
        }
        let result = await this._currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this._currentSearchResult.push(...result.value.subitems)
            const oldCFI = this._currentSearchResult[this._currentSearchResultIndex]?.cfi
            if (oldCFI) {
                this.view.deleteAnnotation({value: oldCFI})
            }
            this._currentSearchResultIndex++
            const newCFI = this._currentSearchResult[this._currentSearchResultIndex].cfi
            await this.view.goTo(newCFI)
            this.view.addAnnotation({value: newCFI, type: 'current-search'})
            return
        }
        else {
            await this.nextMatch()
        }
    }
    boundNextMatch = this.nextMatch.bind(this)

    async prevMatch() {
        if (!this._currentSearch) {
            return
        }
        if (this._currentSearchResult
                && this._currentSearchResult.length > 0
                && this._currentSearchResultIndex > 0
        ) {
            const oldCFI = this._currentSearchResult[this._currentSearchResultIndex]?.cfi
            if (oldCFI) {
                this.view.deleteAnnotation({ value: oldCFI })
            }
            this._currentSearchResultIndex--
            const newCFI = this._currentSearchResult[this._currentSearchResultIndex].cfi
            await this.view.goTo(newCFI)
            this.view.addAnnotation({ value: newCFI, type: 'current-search' })
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        const lastCFI = this._currentSearchResult[this._currentSearchResultIndex]?.cfi
        if (lastCFI) {
            this.view.deleteAnnotation({ value: lastCFI })
        }
        this._currentSearch = undefined
        this._currentSearchResult = []
        this._currentSearchResultIndex = -1
        this.view.clearSearch()
        this.view.deselect()
        this._closeMenus()
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)

    async open(fileUrl, options) {
        let {
            menuItems, initialMenuStatus, ebookTitle, ebookAuthor,
            fontFamily, allowJS, injectMathJaxData, filterEbookContent,
            showAnnotations, showPageDelimiters
        } = options
        this.view = document.createElement('simebv-foliate-view')
        this._bookContainer.append(this.view)
        const file = await fetchFile(fileUrl)
        await this.view.open(fileUrl)
        this._populateMenu(menuItems)
        this._openEbookFormat = await ebookFormat(file)
        if (this.view.isFixedLayout) {
            this._bookContainer.classList.add('simebv-fxd-layout')
        }
        else {
            this._bookContainer.classList.remove('simebv-fxd-layout')
        }
        this.view.addEventListener('load', this._onLoad.bind(this))
        this.view.addEventListener('relocate', this._onRelocate.bind(this))
        this.view.addEventListener('relocate', () => this._canSavePreferences = true, { once: true })
        this.view.history.addEventListener('index-change', this._updateHistoryMenuItems.bind(this))
        this._lastReadPage = this._getLastReadPage()
        const newBookEvent = new CustomEvent('new-book', { detail: {
            fractions: this.view.getSectionFractions(),
            dir: this.view.book.dir
        }})
        this._navBar.dispatchEvent(newBookEvent)

        const { book } = this.view
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            detail.data = Promise
                .resolve(detail.data)
                .then(data => typeof filterEbookContent === 'function' ? filterEbookContent(data) : data)
                .then(data => {
                    const ops = new Map()
                    switch(detail.type) {
                        case 'application/xhtml+xml':
                        case 'text/html':
                            if (!allowJS) {
                                ops.set('addCSPMeta', [])
                            }
                            else if (injectMathJaxData?.url) {
                                ops.set('injectMathJax', [injectMathJaxData.url, injectMathJaxData.config])
                            }
                            ops.set('convertFontSizePxToRem', [this._defaultFontSize])
                            if (ops.size > 0) {
                                data = transformDoc(data, detail.type, ops)
                            }
                            return data
                        case 'image/svg+xml':
                        case 'application/xml':
                            if (!allowJS) {
                                ops.set('removeInlineScripts', [])
                            }
                            if (ops.size > 0) {
                                data = transformDoc(data, detail.type, ops)
                            }
                            return data
                        case 'text/css':
                            return convertFontSizePxToRem(data, this._defaultFontSize)
                        default:
                            return data
                    }
                })
                .catch(e => {
                    console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
                    return ''
                })
        })

        this._navBar.addEventListener('go-left', () => this.view.goLeft())
        this._navBar.addEventListener('go-right', () => this.view.goRight())
        this._navBar.addEventListener('changed-page-slider', ({ detail }) => {
            this.view.goToFraction(parseFloat(detail.newLocation))
        })
        this.container.addEventListener('keydown', this._handleKeydown.bind(this))

        this._metadataFormatter = new MetadataFormatter(this._getEbookLocales())
        if (!ebookTitle) {
            ebookTitle = this._metadataFormatter.formatLanguageMap(book.metadata?.title) || 'Untitled Book'
        }
        this._ebookTitle = ebookTitle
        this._headerBar.setHeader(ebookTitle)
        this._headerBar.dispatchEvent(newBookEvent)
        this._sideBar.setTitle(ebookTitle)
        this._sideBar.setAuthor(ebookAuthor ? ebookAuthor : this._metadataFormatter.formatContributor(book.metadata?.author))
        Promise.resolve(book.getCover?.())?.then(blob =>
            blob ? this._sideBar.setCover(URL.createObjectURL(blob)) : null)
        this._sideBar.addEventListener('show-details', this.openMetadataDialog.bind(this))

        const toc = book.toc
        if (toc) {
            this._tocView = createTOCView(toc, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this._closeMenus()
            })
            this._sideBar.attachToc(this._tocView)
        }

        this.view.addEventListener('draw-annotation', this.drawAnnotationHandler.bind(this))
        this._setInitialAnnotationOptions(showAnnotations, showPageDelimiters)

        // load and show page delimiters if the ebook contains a page list
        const pageList = book.pageList
        if (pageList) {
            const { pageList: pl, pageListByValue } = await createPageListForAnnotations(this, pageList)
            this.pageList = pl
            this.pageListByValue = pageListByValue
            if (this._showPageDelimiters) {
                this.view.addEventListener('create-overlay', this.boundPageListCreateOverlay)
                this.view.addEventListener('show-annotation', this.boundPageListShowAnnotation)
            }
            this._pageListView = createTOCView(pageList, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this._closeMenus()
            })
            this._sideBar.attachPageList(this._pageListView)
        }

        // load and show highlights embedded in the file by Calibre
        const bookmarks = await book.getCalibreBookmarks?.()
        if (bookmarks) {
            for (const obj of bookmarks) {
                if (obj.type === 'highlight') {
                    const value = CFI.fromCalibreHighlight(obj)
                    const color = obj.style.which
                    const note = obj.notes
                    const type = 'calibre-bookmark'
                    const annotation = { value, color, note, type }
                    const list = this.annotations.get(obj.spine_index)
                    if (list) list.push(annotation)
                    else this.annotations.set(obj.spine_index, [annotation])
                    this.annotationsByValue.set(value, annotation)
                }
            }
            if (this._showAnnotations) {
                this.view.addEventListener('create-overlay', this.boundBookmarksCreateOverlay)
                this.view.addEventListener('show-annotation', this.boundBookmarksShowAnnotation)
            }
        }

        // Workaround for the stripping of search parameters
        // from urls by the #handleLinks method of this.view
        this.view.addEventListener('external-link', (e) => {
            if (e.detail.a.href) {
                try {
                    globalThis.open(new URL(e.detail.a.href).href, '_blank')
                    // with e.preventDefault(), the event emitter will return false,
                    // so the method in view.js won't open the (wrong) url
                    e.preventDefault()
                } catch(e) {
                    console.error(`Failed to open url: ${e.detail.a.href}\n`, e)
                }
            }
        })

        this._setInitialMenuStatus(initialMenuStatus)
        this._loadFilterPreferences()
        this._createFilterDialog(this._rootDiv, this.view.isFixedLayout)
        this._createAnnotationsDialog()
        this._setInitialFontFamily(fontFamily)

        if (this._lastReadPage != null) {
            try {
                if (typeof this._lastReadPage === 'string') {
                    await this.view.init({lastLocation: this._lastReadPage})
                }
                else if (this._lastReadPage <= 1 && this._lastReadPage >= 0) {
                    await this.view.init({lastLocation: { fraction: this._lastReadPage }})
                }
            }
            catch (e) {
                this._lastReadPage = null
                console.error('Cannot load last read page:', e)
            }
        }

        this.view.renderer.setStyles?.(getCSS(this.style))
        if (!this._lastReadPage) this.view.renderer.next()

        document.dispatchEvent(new CustomEvent('simebv-ebook-loaded'))

    }

    _populateMenu(customMenuItems) {
        if (customMenuItems) {
            this.menu.addMenuItems(customMenuItems)
            return
        }
        const menuItems = createMenuItemsStd(this, getCSS)
        if (this.view.isFixedLayout) {
            this.menu.addMenuItems([
                menuItems.get('search'),
                menuItems.get('history'),
                menuItems.get('colors'),
                menuItems.get('colorFilter'),
                menuItems.get('zoom'),
                menuItems.get('positionViewer'),
            ])
        }
        else {
            this.menu.addMenuItems([
                menuItems.get('search'),
                menuItems.get('history'),
                menuItems.get('showAnnotations'),
                menuItems.get('layout'),
                menuItems.get('maxPages'),
                menuItems.get('fontSize'),
                menuItems.get('fontFamily'),
                menuItems.get('margins'),
                menuItems.get('colors'),
                menuItems.get('colorFilter'),
                menuItems.get('positionViewer'),
            ])
        }
    }

    _setInitialMenuStatus(initialMenuStatus) {
        this.menu.groups.history?.items.previous.enable(false)
        this.menu.groups.history?.items.next.enable(false)
        if (!initialMenuStatus) {
            initialMenuStatus = getInitialMenuStatusStd()
        }
        let prefs = (initialMenuStatus?.bothBefore || [])
            .concat((this.view.isFixedLayout
                ? initialMenuStatus?.fixedLayout
                : initialMenuStatus?.reflowable) || [])
            .concat(initialMenuStatus?.bothAfter || [])
        this._loadMenuPreferences(prefs)
    }

    _setMenuMaxBlockSize() {
        if (this.menu) {
            const headerHeight = this._headerBar
                ? this._headerBar.root.getBoundingClientRect().bottom - this.container.getBoundingClientRect().top
                : 62
            this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - headerHeight) + 'px)'
        }
    }

    _updateHistoryMenuItems() {
        this.view?.history?.canGoBack
            ? this.menu.groups.history?.items.previous.enable(true)
            : this.menu.groups.history?.items.previous.enable(false)
        this.view?.history?.canGoForward
            ? this.menu.groups.history?.items.next.enable(true)
            : this.menu.groups.history?.items.next.enable(false)
    }

    _getEbookLocales() {
        let lang = this.view?.book?.metadata.language
        if (typeof lang === 'string') {
            lang = [lang]
        }
        return lang?.map(l => {
            try {
                return Intl.getCanonicalLocales(l)[0]
            }
            catch (e) {}
        }).filter(Boolean)
    }

    _toggleFullScreen() {
        if (this.container.requestFullscreen) {
            if (document.fullscreenElement) {
                document.exitFullscreen()
            }
            else {
                this.container.requestFullscreen()
            }
            this._setMenuMaxBlockSize()
        }
        else {
            this._toggleFullViewport()
        }
    }

    _toggleFullViewport() {
        const detail = {}
        if (this.container.classList.contains('simebv-view-fullscreen')) {
            this.container.classList.remove('simebv-view-fullscreen')
            detail.data = 'exit'
        }
        else {
            this.container.classList.add('simebv-view-fullscreen')
            detail.data = 'enter'
        }
        this._headerBar.dispatchEvent(new CustomEvent('toggle-fullscreen', { detail }))
        this._setMenuMaxBlockSize()
    }

    _handleKeydown(e) {
        if (this._colorsFilterDialog.open) {
            return
        }
        const k = e.key
        switch (k) {
            case 'PageUp':
                e.preventDefault()
                this.view.prev()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'PageDown':
                e.preventDefault()
                this.view.next()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'ArrowLeft':
                e.preventDefault()
                this.view.goLeft()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'ArrowRight':
                e.preventDefault()
                this.view.goRight()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'Tab':
                if (this.menu.element.classList.contains('simebv-show')
                        || this._root.querySelector('#simebv-side-bar')?.classList.contains('simebv-show')) {
                    this._closeMenus()
                }
                break
            case 'Escape':
                if (this.menu.element.classList.contains('simebv-show')
                        || this._root.querySelector('#simebv-side-bar')?.classList.contains('simebv-show')
                        || this._searchDialog?.classList.contains('simebv-show')) {
                    this._closeMenus()
                }
                else if (this._realFullscreen && document.fullscreenElement) {
                    this._toggleFullScreen()
                }
                else if (this.container.classList.contains('simebv-view-fullscreen')) {
                    this._toggleFullViewport()
                }
                break
            case 'f':
                if (e.ctrlKey) {
                    this._closeMenus()
                    this.openSearchDialog()
                    e.preventDefault()
                }
                break
        }
    }

    _onLoad({ detail: { doc } }) {
        const loadingOverlay = this._root.getElementById('simebv-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('simebv-show');
        }
        doc.addEventListener('keydown', this._handleKeydown.bind(this))
        if (this.view.isFixedLayout) {
            doc.addEventListener('dblclick', () => {
                if (['fit-page', 'fit-width'].includes(this.menu.groups.zoom?.current())) {
                    this.menu.groups.zoom?.select('custom')
                }
                else {
                    this.menu.groups.zoom?.select('fit-page')
                }
            })
        }
    }

    _onRelocate({ detail }) {
        const { fraction, section, location, tocItem, pageItem } = detail
        this._savePreference(
            (this.getBookIdentifier() ?? this.getCurrentTitle()) + '_LastPage', detail.cfi ?? fraction
        )
        const percent = percentFormat.format(fraction)
        const loc = pageItem
            ? sprintf(
                /* translators: %1$s: page number */
                __('Page %1$s', 'simple-ebook-viewer'), pageItem.label
            )
            : sprintf(
                /* translators: Location in the book, followed by a numerical fraction */
                __('Location %1$s/%2$s', 'simple-ebook-viewer'), location.current + 1, location.total
            )
        let currentPage = location.current + 1
        let totalPages = location.total
        if (this.view.isFixedLayout) {
            currentPage = section.current + 1
            totalPages = section.total
        }
        const page = pageItem
            ? sprintf(
                /* translators: %1$s: page number */
                __('Page %1$s', 'simple-ebook-viewer'), pageItem.label)
            : sprintf(
                /* translators: current page number / total pages number */
                __('Page %1$s / %2$s', 'simple-ebook-viewer'), currentPage, totalPages)
        this._navBar.dispatchEvent(new CustomEvent('relocate', { detail: {
            sliderValue: fraction,
            sliderTitle: `${percent} · ${loc}`,
            percent,
            page,
        }}))
        if (tocItem?.href) this._tocView?.setCurrentHref?.(tocItem.href)
        if (pageItem?.href) this._pageListView?.setCurrentHref?.(pageItem.href)
    }

    getBookIdentifier() {
        return this.view?.book?.metadata?.identifier || null
    }

    getCurrentTitle() {
        return this._ebookTitle
    }

    _getLastReadPage() {
        const iden = this.getBookIdentifier() ?? this.getCurrentTitle()
        return this._loadPreference(iden + '_LastPage')
    }

    _setInitialAnnotationOptions(showAnnotationsAttr, showPageDelimitAttr) {
        const showAnnotations = this._loadPreference('show-annotations') ?? showAnnotationsAttr
        const showPageDelimit = this._loadPreference('show-page-delimiters') ?? showPageDelimitAttr
        this._showAnnotations = !!showAnnotations
        this._showPageDelimiters = !!showPageDelimit
    }

    _setInitialFontFamily(fontFamilyAttr) {
        let fontFamily = this._loadPreference('font-family')
        if (!fontFamily && fontFamilyAttr !== 'auto') {
            fontFamily = fontFamilyAttr
            // this usually won't have an effect (this._canSavePreferences is initially set to false)
            this._savePreference('font-family', fontFamily)
        }
        this.style.fontFamily = fontFamily
    }

    _savePreferences(prefs) {
        if (!storageAvailable('localStorage') || !this._canSavePreferences) {
            return
        }
        for (const [name, value] of prefs) {
            this._savePreference(name, value)
        }
    }

    _loadFilterPreferences() {
        if (!this._appliedFilter) {
            return
        }
        for (const prop in this._appliedFilter) {
            let value = this.container.getAttribute('data-simebv-' + prop.toLowerCase())
            value = Reader._convertUserSettings(prop, value)
            if (value != null) {
                this._appliedFilter[prop] = value
            }
        }
        if (storageAvailable('localStorage')) {
            for (const prop in this._appliedFilter) {
                let value = JSON.parse(localStorage.getItem('simebv-' + prop))
                if (value != null) {
                    this._appliedFilter[prop] = value
                }
            }
        }
    }

    _savePreference(name, value) {
        if (!storageAvailable('localStorage') || !this._canSavePreferences) {
            return
        }
        localStorage.setItem('simebv-' + name, JSON.stringify(value))
    }

    _loadPreference(name) {
        if (!storageAvailable('localStorage')) {
            return
        }
        return JSON.parse(localStorage.getItem('simebv-' + name))
    }

    static _convertUserSettings(name, value) {
        const converter = {
            colors: {
                sepia: 'simebv-sepia',
                light: 'simebv-light',
                dark: 'simebv-dark',
                'light-forced': 'simebv-light-forced',
                'dark-forced': 'simebv-dark-forced',
            },
            margins: {
                small: '4%',
                medium: '8%',
                large: '12%',
            },
            fontsize: {
                small: 14,
                medium: 18,
                large: 22,
                'x-large': 26,
            },
            activatecolorfilter: {
                'true': true,
                'false': false,
            },
            bgfiltertransparent: {
                'true': true,
                'false': false,
            },
        }
        if (isNumeric(value)) {
            value = Number(value)
        }
        return converter[name.toLowerCase()]?.[value] ?? value
    }

    _loadMenuPreferences(values) {
        if (!this.menu) {
            return
        }
        // Retrieve data set by the user server side, validate it and store it as default
        const defValues = values.map((item) => {
            const [name, _] = item
            let attrVal = this.container.getAttribute('data-simebv-' + name.toLowerCase())
            attrVal = Reader._convertUserSettings(name, attrVal)
            if (attrVal && this.menu.groups[name]?.validate(attrVal)) {
                return [name, attrVal]
            }
            return item
        })
        // if there is no localStorage available, select default values on the menu
        if (!storageAvailable('localStorage')) {
            for (const [name, defVal] of defValues) {
                this.menu.groups[name]?.select(defVal)
            }
            return
        }
        // Retrieve data from localStorage, validate it and select it on the menu, otherwise use default
        for (const [name, defVal] of defValues) {
            if (name === 'zoom') {
                const savedCustomZoom = this._loadPreference('custom-zoom')
                if (this.menu.groups.zoom?.validate(savedCustomZoom)) {
                    // this will not trigger the change event
                    this.menu.element.querySelector('#simebv-zoom-numeric').value = savedCustomZoom
                }
            }
            let savedVal = JSON.parse(localStorage.getItem('simebv-' + name))
            this.menu.groups[name]?.validate(savedVal)
                ? this.menu.groups[name].select(savedVal)
                : (
                    this.menu.groups[name]?.select(defVal),
                    console.warn(`Invalid value for menu ${name}: ${savedVal}, setting default: ${defVal}`)
                )
        }
    }

    setLocalizedDefaultInterface(root) {
        root.getElementById('simebv-loading-overlay-text').innerText = __('Loading...', 'simple-ebook-viewer')
        root.getElementById('simebv-book-container').setAttribute('aria-label', __('Ebook contents', 'simple-ebook-viewer'))
    }
}

const readerMarkup = `
<style>
${viewerUiCss}
</style>
<div id="simebv-reader-root">
    <div id="simebv-loading-overlay" class="simebv-show">
        <p id="simebv-loading-overlay-text">Loading...</p>
    </div>
    <div id="simebv-dimming-overlay"></div>
    <section id="simebv-side-bar"></section>
    <div id="simebv-header-bar"></div>
    <div id="simebv-nav-bar"></div>
    <div id="simebv-book-container" tabindex="0"></div>
</div>
`


// from vendor/foliate-js/view.js
const fetchFile = async url => {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(
            `${res.status} ${res.statusText}`, { cause: res }
        )
    }
    return new File([await res.blob()], new URL(res.url).pathname)
}


export const get_ebook_url = async id => {
    await wp.api.loadPromise
    let media = new wp.api.models.Media({ id: id })
    let res = await media.fetch()
    return new URL(res.source_url).href
}


export const show_error_msg = (container, msg) => {
    container.style.textAlign = 'center'
    container.style.padding = '12px'
    container.innerText = ''
    container.append(msg)
}


export const gatherOptionsFromContainer = container => {
    const options = {
        reader: {},
        ebook: {}
    }
    if (container.getAttribute('data-simebv-always-full-viewport') === 'true') {
        options.reader.alwaysFullViewport = true
    }
    if (container.getAttribute('data-simebv-show-close-button') === 'true') {
        options.reader.showCloseButton = true
    }
    let return_to_url = container.getAttribute('data-simebv-return-to-url')
    if (return_to_url) {
        return_to_url = new URL(return_to_url)
        if (return_to_url.origin === window.location.origin) {
            options.reader.closeViewerCallback = () => window.location.assign(return_to_url.href)
        }
    }
    if (container.getAttribute('data-simebv-real-fullscreen') === 'true') {
        options.reader.realFullscreen = true
    }
    if (container.getAttribute('data-simebv-allow-js') === 'true') {
        options.ebook.allowJS = true
    }
    if (container.hasAttribute('data-simebv-font-family')) {
        options.ebook.fontFamily = container.getAttribute('data-simebv-font-family')
    }
    if (container.getAttribute('data-simebv-show-annotations') === 'true') {
        options.ebook.showAnnotations = true
    }
    if (container.getAttribute('data-simebv-show-page-delimiters') === 'true') {
        options.ebook.showPageDelimiters = true
    }
    options.ebook.ebookTitle = container.getAttribute('data-simebv-ebook-title') || ''
    options.ebook.ebookAuthor = container.getAttribute('data-simebv-ebook-author') || ''
    return options
}


export const initializeViewer = async containerID => {
    const ebook_path_el = document.getElementById(containerID);
    if (ebook_path_el) {
        let url
        try {
            url = await get_ebook_url(ebook_path_el.getAttribute('data-ebook-id'))
        } catch (e) {
            if (url) url = undefined
            const msg = __('Error: I couldn\'t retrieve the book to display.', 'simple-ebook-viewer')
            show_error_msg(ebook_path_el, msg)
            console.error(e)
            if (e.status === 404) {
                ebook_path_el.append(
                    document.createElement('br'),
                    __('Resource not found on the server', 'simple-ebook-viewer')
                )
            }
            else if (e.responseJSON?.message) {
                ebook_path_el.append(document.createElement('br'), e.responseJSON.message)
            }
        }
        if (url) {
            try {
                const options = gatherOptionsFromContainer(ebook_path_el)
                const reader = new Reader(ebook_path_el, options.reader)
                await reader.open(url, options.ebook)
            } catch (e) {
                const msg = document.createElement('p')
                msg.append(
                    __('Error while opening the book:', 'simple-ebook-viewer'),
                    document.createElement('br'),
                    e.message
                )
                if (ebook_path_el.shadowRoot) {
                    ebook_path_el.shadowRoot.innerHTML = ''
                    const newRoot = document.createElement('div')
                    ebook_path_el.shadowRoot.append(newRoot)
                    show_error_msg(newRoot, msg)
                }
                else {
                    show_error_msg(ebook_path_el, msg)
                }
                console.error(e)
            }
        }
    }
}


export * from './simebv-view.js'
export * from './simebv-navbar.js'
export * from './simebv-header.js'
export * from './simebv-sidebar.js'
export * from './simebv-utils.js'
export * from './simebv-search-dialog.js'
export * from './simebv-filters-dialog.js'
export * from './simebv-metadata-dialog.js'
export * from './simebv-fonts-dialog.js'
export * from './simebv-annotations-dialog.js'
export * from './simebv-menu.js'
export * from './simebv-menu-items.js'
export * from './simebv-ebook-format.js'
export * from '../../vendor/foliate-js/ui/tree.js'
export * from '../../vendor/foliate-js/overlayer.js'
export * as CFI from '../../vendor/foliate-js/epubcfi.js'
