import '../../vendor/foliate-js/view.js'
import { createTOCView } from '../../vendor/foliate-js/ui/tree.js'
import { Overlayer } from '../../vendor/foliate-js/overlayer.js'
import { storageAvailable, addCSPMeta, removeInlineScripts, isNumeric } from './simebv-utils.js'
import { searchDialog } from './simebv-search-dialog.js'
import { colorFiltersDialog } from './simebv-filters-dialog.js'
import { Menu } from './simebv-menu.js'
import { createMenuItemsStd } from './simebv-menu-items.js'
import { ebookFormat } from './simebv-ebook-format.js'
import { NavBar } from './simebv-navbar.js'
const { __, _x, _n, sprintf } = wp.i18n;

// Import css for the Viewer's container element, as static asset
import '../css/simebv-container.css'
// Import css for the Viewer's UI, as string
import viewerUiCss from '../css/simebv-viewer.css?raw'
// CSS to inject in iframe of reflowable ebooks
export const getCSS = ({ spacing, justify, hyphenate, fontSize, colorScheme, bgColor }) => `
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
`

const locales = 'en'
const percentFormat = new Intl.NumberFormat(locales, { style: 'percent' })
const listFormat = new Intl.ListFormat(locales, { style: 'short', type: 'conjunction' })

const formatLanguageMap = x => {
    if (!x) return ''
    if (typeof x === 'string') return x
    const keys = Object.keys(x)
    return x[keys[0]]
}

const formatOneContributor = contributor => typeof contributor === 'string'
    ? contributor : formatLanguageMap(contributor?.name)

const formatContributor = contributor => Array.isArray(contributor)
    ? listFormat.format(contributor.map(formatOneContributor))
    : formatOneContributor(contributor)

export class Reader {
    _root
    _rootDiv
    _bookContainer
    _tocView
    _navBar
    _sideBar
    _sideBarButton
    _overlay
    _menuButton
    _fullscreenButton
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
    }
    annotations = new Map()
    annotationsByValue = new Map()
    container
    menu

    _closeMenus() {
        let focusTo
        if (this._sideBar.classList.contains('simebv-show')) {
            focusTo = this._sideBarButton
        }
        this._overlay.classList.remove('simebv-show')
        this._sideBar.classList.remove('simebv-show')
        this.menu.hide()
        if (focusTo) {
            focusTo.focus()
        }
    }

    constructor(container, { menu, navBar } = {}) {
        this.container = container ?? document.body
        this._root = this.container.attachShadow({ mode: 'open' })
        this._root.innerHTML = readerMarkup
        this._rootDiv = this._root.querySelector('#simebv-reader-root')
        this._bookContainer = this._root.querySelector('#simebv-book-container')
        this._sideBar = this._root.querySelector('#simebv-side-bar')
        this._sideBarButton = this._root.querySelector('#simebv-side-bar-button')
        this._overlay = this._root.querySelector('#simebv-dimming-overlay')
        this._menuButton = this._root.querySelector('#simebv-menu-button')
        this._fullscreenButton = this._root.querySelector('#full-screen-button')

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
        this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'

        this.setLocalizedDefaultInterface(this._root)

        this._sideBarButton.addEventListener('click', () => {
            this._sideBar.style.display = null;
            setTimeout(() => {
                this._overlay.classList.add('simebv-show')
                this._sideBar.classList.add('simebv-show')
                this._tocView.getCurrentItem()?.focus()
            }, 20)
        })
        this._overlay.addEventListener('click', () => {
            this._closeMenus()
        })
        this._sideBar.addEventListener('click', () => {
            this._tocView.getCurrentItem()?.focus()
        })
        this._root.addEventListener('closeMenu', () => {
            if (!this._sideBar.classList.contains('simebv-show')) {
                this._overlay.classList.remove('simebv-show')
            }
        })

        if (screen?.orientation) {
            screen.orientation.addEventListener('change', () => {
                this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'
            })
        }

        this._menuButton.append(this.menu.element)
        this._menuButton.querySelector('button').addEventListener('click', (e) => {
            if (!this.menu.element.classList.contains('simebv-show')) {
                this.menu.show(this._menuButton.querySelector('button'))
                this._overlay.classList.add('simebv-show')
            }
            else {
                this._closeMenus()
            }
        })

        this._fullscreenButton.addEventListener('click', this._toggleFullViewport.bind(this))
    }

    get containerHeight() {
        return this.container.getBoundingClientRect().height
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

    async doSearch(str) {
        if (this._currentSearch && this._currentSearchQuery === str) {
            await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this._currentSearchQuery = str
        this._currentSearch = await this.view?.search({query: str})
        await this.nextMatch()
    }
    boundDoSearch = this.doSearch.bind(this)

    async nextMatch() {
        if (!this._currentSearch) {
            return
        }
        if (this._currentSearchResult
                && this._currentSearchResult.length > 0
                && this._currentSearchResultIndex < this._currentSearchResult.length - 1
        ) {
            this._currentSearchResultIndex++
            await this.view.goTo(this._currentSearchResult[this._currentSearchResultIndex].cfi)
            return
        }
        let result = await this._currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this._currentSearchResult.push(...result.value.subitems)
            this._currentSearchResultIndex++
            await this.view.goTo(this._currentSearchResult[this._currentSearchResultIndex].cfi)
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
            this._currentSearchResultIndex--
            await this.view.goTo(this._currentSearchResult[this._currentSearchResultIndex].cfi)
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        this._currentSearch = undefined
        this._currentSearchResult = []
        this._currentSearchResultIndex = -1
        this.view.clearSearch()
        this.view.deselect()
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)

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
                menuItems.get('layout'),
                menuItems.get('maxPages'),
                menuItems.get('fontSize'),
                menuItems.get('margins'),
                menuItems.get('colors'),
                menuItems.get('colorFilter'),
                menuItems.get('positionViewer'),
            ])
        }
    }

    async open(fileUrl, { customMenuItems } = {}) {
        this.view = document.createElement('foliate-view')
        this._bookContainer.append(this.view)
        const file = await fetchFile(fileUrl)
        await this.view.open(fileUrl)
        this._populateMenu(customMenuItems)
        this.view.book.ebookFormat = await ebookFormat(file)
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
        this._navBar.dispatchEvent(new CustomEvent('new-book', { detail: {
            fractions: this.view.getSectionFractions(),
            dir: this.view.book.dir
        }}))

        const { book } = this.view
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            detail.data = Promise
                .resolve(detail.data)
                .then(data => {
                    switch(detail.type) {
                        case 'application/xhtml+xml':
                        case 'text/html':
                            return addCSPMeta(data, detail.type)
                        case 'image/svg+xml':
                        case 'application/xml':
                            return removeInlineScripts(data, detail.type)
                        default:
                            return data
                    }
                })
                .catch(e => {
                    console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
                    return ''
                })
        })

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

        this._root.querySelector('#simebv-header-bar').style.visibility = 'visible'
        this._navBar.addEventListener('go-left', () => this.view.goLeft())
        this._navBar.addEventListener('go-right', () => this.view.goRight())
        this._navBar.addEventListener('changed-page-slider', ({ detail }) => {
            this.view.goToFraction(parseFloat(detail.newLocation))
        })

        this.container.addEventListener('keydown', this._handleKeydown.bind(this))
        const title = formatLanguageMap(book.metadata?.title) || 'Untitled Book'
        document.title = title
        this._root.querySelector('#simebv-book-header').innerText = title
        this._root.querySelector('#simebv-side-bar-title').innerText = title
        this._root.querySelector('#simebv-side-bar-author').innerText = formatContributor(book.metadata?.author)
        Promise.resolve(book.getCover?.())?.then(blob =>
            blob ? this._root.querySelector('#simebv-side-bar-cover').src = URL.createObjectURL(blob) : null)

        const toc = book.toc
        if (toc) {
            this._tocView = createTOCView(toc, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this._closeMenus()
            })
            this._root.querySelector('#simebv-toc-view').append(this._tocView.element)
        }

        // load and show highlights embedded in the file by Calibre
        const bookmarks = await book.getCalibreBookmarks?.()
        if (bookmarks) {
            const { fromCalibreHighlight } = await import('../../vendor/foliate-js/epubcfi.js')
            for (const obj of bookmarks) {
                if (obj.type === 'highlight') {
                    const value = fromCalibreHighlight(obj)
                    const color = obj.style.which
                    const note = obj.notes
                    const annotation = { value, color, note }
                    const list = this.annotations.get(obj.spine_index)
                    if (list) list.push(annotation)
                    else this.annotations.set(obj.spine_index, [annotation])
                    this.annotationsByValue.set(value, annotation)
                }
            }
            this.view.addEventListener('create-overlay', e => {
                const { index } = e.detail
                const list = this.annotations.get(index)
                if (list) for (const annotation of list)
                    this.view.addAnnotation(annotation)
            })
            this.view.addEventListener('draw-annotation', e => {
                const { draw, annotation } = e.detail
                const { color } = annotation
                draw(Overlayer.highlight, { color })
            })
            this.view.addEventListener('show-annotation', e => {
                const annotation = this.annotationsByValue.get(e.detail.value)
                if (annotation.note) alert(annotation.note)
            })
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

        this.menu.groups.history?.items.previous.enable(false)
        this.menu.groups.history?.items.next.enable(false)
        this._loadMenuPreferences([
            ['colors', 'auto'],
            ['positionViewer', 'slider'],
        ])
        if (this.view.isFixedLayout) {
            this._loadMenuPreferences([
                ['zoom', 'fit-page']
            ])
        }
        else {
            this._loadMenuPreferences([
                ['fontSize', 18],
                ['maxPages', 2],
                ['margins', '8%'],
                ['layout', 'paginated'],  // the 'scrolled' layout disables other preferences, so this is at the end
            ])
        }
        this._loadFilterPreferences()
        this._createFilterDialog(this._rootDiv, this.view.isFixedLayout)
    }

    _updateHistoryMenuItems() {
        this.view?.history?.canGoBack
            ? this.menu.groups.history?.items.previous.enable(true)
            : this.menu.groups.history?.items.previous.enable(false)
        this.view?.history?.canGoForward
            ? this.menu.groups.history?.items.next.enable(true)
            : this.menu.groups.history?.items.next.enable(false)
    }

    _toggleFullScreen() {
        if (this.view && this.view.requestFullscreen) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            else {
                this.view.requestFullscreen();
            }
        }
    }

    _toggleFullViewport() {
        if (this.container.classList.contains('simebv-view-fullscreen')) {
            this.container.classList.remove('simebv-view-fullscreen')
            this._fullscreenButton.querySelector('#simebv-icon-enter-fullscreen').classList.remove('simebv-icon-hidden')
            this._fullscreenButton.querySelector('#simebv-icon-exit-fullscreen').classList.add('simebv-icon-hidden')
        }
        else {
            this.container.classList.add('simebv-view-fullscreen')
            this._fullscreenButton.querySelector('#simebv-icon-enter-fullscreen').classList.add('simebv-icon-hidden')
            this._fullscreenButton.querySelector('#simebv-icon-exit-fullscreen').classList.remove('simebv-icon-hidden')
        }
        if (this.menu) {
            this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'
        }
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
                break
            case 'PageDown':
                e.preventDefault()
                this.view.next()
                break
            case 'ArrowLeft':
                this.view.goLeft()
                break
            case 'ArrowRight':
                this.view.goRight()
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
                else if (this.container.classList.contains('simebv-view-fullscreen')) {
                    this.container.classList.remove('simebv-view-fullscreen')
                }
                break
            case 'f':
                if (e.ctrlKey) {
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
                /* translators: %1s: page number */
                __('Page %1$s', 'simple-ebook-viewer'), pageItem.label
            )
            : sprintf(
                /* translators: Loc: contraction for 'Location' in the book, followed by a numerical fraction */
                __('Loc %1$s/%2$s', 'simple-ebook-viewer'), location.current, location.total
            )
        let currentPage = location.current + 1
        let totalPages = location.total
        if (this.view.isFixedLayout) {
            currentPage = section.current + 1
            totalPages = section.total
        }
        const page = sprintf(
            __('Page %1$s / %2$s', 'simple-ebook-viewer'), currentPage, totalPages
        )
        this._navBar.dispatchEvent(new CustomEvent('relocate', { detail: {
            sliderValue: fraction,
            sliderTitle: `${percent} · ${loc}`,
            percent,
            page,
        }}))
        if (tocItem?.href) this._tocView?.setCurrentHref?.(tocItem.href)
    }

    getBookIdentifier() {
        return this.view?.book?.metadata?.identifier || null
    }

    getCurrentTitle() {
        return formatLanguageMap(this.view?.book?.metadata?.title) || 'Untitled Book'
    }

    _getLastReadPage() {
        const iden = this.getBookIdentifier() ?? this.getCurrentTitle()
        return this._loadPreference(iden + '_LastPage')
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
        const sideBarButton = root.getElementById('simebv-side-bar-button')
        const sideBarButtonLabel = __('Show sidebar', 'simple-ebook-viewer')
        sideBarButton.setAttribute('aria-label', sideBarButtonLabel)
        sideBarButton.title = sideBarButtonLabel

        const header = root.getElementById('simebv-book-header').innerText = __('No title', 'simple-ebook-viewer')
        const settingsButton = root.querySelector('#simebv-menu-button button')
        const settingsButtonLabel = __('Show settings', 'simple-ebook-viewer')
        settingsButton.setAttribute('aria-label', settingsButtonLabel)
        settingsButton.title = settingsButtonLabel

        const fullScreenButton = root.getElementById('full-screen-button')
        const fullScreenButtonLabel = __('Full screen', 'simple-ebook-viewer')
        fullScreenButton.setAttribute('aria-label', fullScreenButtonLabel)
        fullScreenButton.title = fullScreenButtonLabel
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
    <div id="simebv-header-bar" class="simebv-toolbar">
        <div class="simebv-left-side-buttons">
            <button id="simebv-side-bar-button" aria-label="Show sidebar">
                <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M 4 6 h 16 M 4 12 h 16 M 4 18 h 16"/>
                </svg>
            </button>
        </div>
        <header id="simebv-headline-container" class="simebv-reader-headline">
            <h1 id="simebv-book-header">No title</h1>
        </header>
        <div class="simebv-right-side-buttons">
            <div id="simebv-menu-button" class="simebv-menu-container">
                <button aria-label="Show settings" aria-haspopup="true">
                    <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12.7a7 7 0 0 1 0-1.4l-1.8-2 2-3.5 2.7.5a7 7 0 0 1 1.2-.7L10 3h4l.9 2.6 1.2.7 2.7-.5 2 3.4-1.8 2a7 7 0 0 1 0 1.5l1.8 2-2 3.5-2.7-.5a7 7 0 0 1-1.2.7L14 21h-4l-.9-2.6a7 7 0 0 1-1.2-.7l-2.7.5-2-3.4 1.8-2Z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </div>
            <div class="simebv-right-side-button-container">
                <button id="full-screen-button" aria-label="Full screen">
                    <svg width="32" height="32" viewBox="-2 -2 28 28" class="simebv-icon" id="simebv-icon-enter-fullscreen" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 2H4C2.89543 2 2 2.89543 2 4V8" stroke-width="1.8"/>
                        <path d="M22 8L22 4C22 2.89543 21.1046 2 20 2H16" stroke-width="1.8"/>
                        <path d="M16 22L20 22C21.1046 22 22 21.1046 22 20L22 16" stroke-width="1.8"/>
                        <path d="M8 22L4 22C2.89543 22 2 21.1046 2 20V16" stroke-width="1.8"/>
                    </svg>
                    <svg class="simebv-icon simebv-icon-hidden" id="simebv-icon-exit-fullscreen" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 12 L12 12 12 4 M20 4 L20 12 28 12 M4 20 L12 20 12 28 M28 20 L20 20 20 28" stroke-width="1.8" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
    <section id="simebv-side-bar">
        <div id="simebv-side-bar-header">
            <img id="simebv-side-bar-cover">
            <div>
                <h2 id="simebv-side-bar-title"></h2>
                <p id="simebv-side-bar-author"></p>
            </div>
        </div>
        <div id="simebv-toc-view"></div>
    </section>
    <div id="simebv-book-container"></div>
    <div id="simebv-nav-bar"></div>
</div>
`

const dragOverHandler = e => e.preventDefault()
const dropHandler = e => {
    e.preventDefault()
    const item = Array.from(e.dataTransfer.items)
        .find(item => item.kind === 'file')
    if (item) {
        const entry = item.webkitGetAsEntry()
        open(entry.isFile ? item.getAsFile() : entry).catch(e => console.error(e))
    }
}


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


export const open = async (file, args, containerID) => {
    let container = document.getElementById(containerID)
    if (!container) {
        container = document.createElement('section')
        container.id = containerID
    }
    const reader = new Reader(container, args)
    await reader.open(file)
    return container
}


const get_ebook_url = async id => {
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
            open(url, undefined, containerID).catch(e => console.error(e));
        }
    }
}
