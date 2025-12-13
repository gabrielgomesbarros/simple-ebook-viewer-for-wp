import '../../vendor/foliate-js/view.js'
import { createTOCView } from '../../vendor/foliate-js/ui/tree.js'
import { createMenu } from '../../vendor/foliate-js/ui/menu.js'
import { Overlayer } from '../../vendor/foliate-js/overlayer.js'
import { storageAvailable, addCSPMeta, removeInlineScripts, isNumeric } from './simebv-utils.js'
import { searchDialog } from './simebv-search-dialog.js'
import { colorFiltersDialog } from './simebv-filters-dialog.js'
const { __, _x, _n, sprintf } = wp.i18n;

// Import css for the Viewer's container element, as static asset
import '../css/simebv-container.css'
// Import css for the Viewer's UI, as string
import viewerUiCss from '../css/simebv-viewer.css?raw'
// CSS to inject in iframe of reflowable ebooks
const getCSS = ({ spacing, justify, hyphenate, fontSize, colorScheme, bgColor }) => `
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
    #root
    #rootDiv
    #bookContainer
    #tocView
    #sideBar
    #sideBarButton
    #overlay
    #menuButton
    #fullscreenButton
    #colorsFilterDialog
    #searchDialog
    #currentSearch
    #currentSearchQuery
    #currentSearchResult = []
    #currentSearchResultIndex = -1
    #lastReadPage
    // don't save user preferences during page load, but only upon user interaction
    #canSavePreferences = false
    #appliedFilter = {
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

    closeMenus() {
        let focusTo
        if (this.#sideBar.classList.contains('simebv-show')) {
            focusTo = this.#sideBarButton
        }
        this.#overlay.classList.remove('simebv-show')
        this.#sideBar.classList.remove('simebv-show')
        this.menu.element.hide()
        if (focusTo) {
            focusTo.focus()
        }
    }

    constructor(container) {
        this.container = container ?? document.body
        this.#root = this.container.attachShadow({ mode: 'open' })
        this.#root.innerHTML = readerMarkup
        this.#rootDiv = this.#root.querySelector('#simebv-reader-root')
        this.setLocalizedDefaultInterface(this.#root)
        this.#bookContainer = this.#root.querySelector('#simebv-book-container')
        this.#sideBar = this.#root.querySelector('#simebv-side-bar')
        this.#sideBarButton = this.#root.querySelector('#simebv-side-bar-button')
        this.#overlay = this.#root.querySelector('#simebv-dimming-overlay')
        this.#menuButton = this.#root.querySelector('#simebv-menu-button')
        this.#fullscreenButton = this.#root.querySelector('#full-screen-button')

        this.#sideBarButton.addEventListener('click', () => {
            this.#sideBar.style.display = null;
            setTimeout(() => {
                this.#overlay.classList.add('simebv-show')
                this.#sideBar.classList.add('simebv-show')
                this.#tocView.getCurrentItem()?.focus()
            }, 20)
        })
        this.#overlay.addEventListener('click', () => {
            this.closeMenus()
        })
        this.#sideBar.addEventListener('click', () => {
            this.#tocView.getCurrentItem()?.focus()
        })
        this.#root.addEventListener('closeMenu', () => {
            if (!this.#sideBar.classList.contains('simebv-show')) {
                this.#overlay.classList.remove('simebv-show')
            }
        })

        this.menu = createMenu([
            {
                name: 'search',
                label: __('Search...', 'simple-ebook-viewer'),
                shortcut: 'Ctrl+F',
                type: 'action',
                onclick: () => this.openSearchDialog(),
                attrs: [
                    ['aria-haspopup', 'dialog'],
                ],
            },
            {
                name: 'history',
                label: __('History', 'simple-ebook-viewer'),
                type: 'group',
                items: [
                    {
                        name: 'previous',
                        label: __('Previous', 'simple-ebook-viewer'),
                        classList: ['simebv-action-menu-item'],
                        onclick: () => {
                            this.view?.history?.back()
                        }
                    },
                    {
                        name: 'next',
                        label: __('Next', 'simple-ebook-viewer'),
                        classList: ['simebv-action-menu-item'],
                        onclick: () => {
                            this.view?.history?.forward()
                        }
                    }
                ]
            },
            {
                name: 'layout',
                label: __('Layout', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    [__('Paginated', 'simple-ebook-viewer'), 'paginated'],
                    [__('Scrolled', 'simple-ebook-viewer'), 'scrolled'],
                ],
                onclick: value => {
                    if (value === 'scrolled') {
                        this.menu.groups.maxPages.enable(false)
                        this.menu.groups.margins.enable(false)
                    }
                    else {
                        this.menu.groups.maxPages.enable(true)
                        this.menu.groups.margins.enable(true)
                    }
                    this.view?.renderer.setAttribute('flow', value)
                    this.#savePreference('layout', value)
                },
                horizontal: false,
            },
            {
                name: 'maxPages',
                label: __('Max pages per view', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    ['1', 1], ['2', 2], ['3', 3], ['4', 4],
                ],
                onclick: value => {
                    this.view?.renderer.setAttribute('max-column-count', value)
                    this.#savePreference('maxPages', value)
                },
                horizontal: true,
            },
            {
                name: 'fontSize',
                label: __('Font Size', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    [_x('Small', 'Font Size', 'simple-ebook-viewer'), 14],
                    [_x('Medium', 'Font Size', 'simple-ebook-viewer'), 18],
                    [_x('Large', 'Font Size', 'simple-ebook-viewer'), 22],
                    [_x('X-Large', 'Font Size', 'simple-ebook-viewer'), 26],
                ],
                onclick: value => {
                    this.style.fontSize = value
                    this.view?.renderer.setStyles?.(getCSS(this.style))
                    this.#savePreference('fontSize', value)
                },
                horizontal: false,
            },
            {
                name: 'margins',
                label: __('Page Margins', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    [_x('Small', 'Margins', 'simple-ebook-viewer'), '4%'],
                    [_x('Medium', 'Margins', 'simple-ebook-viewer'), '8%'],
                    [_x('Large', 'Margins', 'simple-ebook-viewer'), '12%'],
                ],
                onclick: value => {
                    this.view?.renderer.setAttribute('gap', value)
                    this.view?.renderer.setAttribute('max-block-size', `calc(100% - ${value.slice(0, -1) * 2}%)`)
                    this.#savePreference('margins', value)
                },
                horizontal: false,
            },
            {
                name: 'colors',
                label: __('Colors', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    [_x('Auto', 'Theme color', 'simple-ebook-viewer'), 'auto'],
                    [_x('Sepia', 'Theme color', 'simple-ebook-viewer'), 'simebv-sepia'],
                    [_x('Light', 'Theme color', 'simple-ebook-viewer'), 'simebv-light'],
                    [_x('Dark', 'Theme color', 'simple-ebook-viewer'), 'simebv-dark'],
                ],
                onclick: value => {
                    switch (value) {
                        case 'simebv-sepia':
                            this.#rootDiv.classList.add(value)
                            this.#rootDiv.classList.remove(
                                'simebv-supports-dark', 'simebv-light', 'simebv-dark'
                            )
                            this.style.colorScheme = 'only light'
                            this.style.bgColor = '#f9f1cc'
                            this.view?.renderer.setStyles?.(getCSS(this.style))
                            break
                        case 'simebv-light':
                            this.#rootDiv.classList.add(value)
                            this.#rootDiv.classList.remove(
                                'simebv-supports-dark', 'simebv-sepia', 'simebv-dark'
                            )
                            this.style.colorScheme = 'only light'
                            this.style.bgColor = '#ffffff'
                            this.view?.renderer.setStyles?.(getCSS(this.style))
                            break
                        case 'simebv-dark':
                            this.#rootDiv.classList.add(value)
                            this.#rootDiv.classList.remove(
                                'simebv-supports-dark', 'simebv-sepia', 'simebv-light'
                            )
                            this.style.colorScheme = 'only dark'
                            this.style.bgColor = '#090909'
                                this.view?.renderer.setStyles?.(getCSS(this.style))
                            break
                        case 'auto':
                        default:
                            this.#rootDiv.classList.add('simebv-supports-dark')
                            this.#rootDiv.classList.remove(
                                'simebv-sepia', 'simebv-light', 'simebv-dark'
                            )
                            this.style.colorScheme = 'light dark'
                            this.style.bgColor = 'transparent'
                            this.view?.renderer.setStyles?.(getCSS(this.style))
                    }
                    this.#savePreference('colors', value)
                },
                horizontal: false,
            },
            {
                name: 'colorFilter',
                label: __('Color filter...', 'simple-ebook-viewer'),
                type: 'action',
                onclick: () => this.openFilterDialog(this.#bookContainer),
                attrs: [
                    ['aria-haspopup', 'dialog'],
                ],
            },
            {
                name: 'zoom',
                label: __('Zoom', 'simple-ebook-viewer'),
                type: 'radio',
                items: [
                    [__('Fit page', 'simple-ebook-viewer'), 'fit-page'],
                    [__('Fit width', 'simple-ebook-viewer'), 'fit-width'],
                    [__('Custom', 'simple-ebook-viewer'), {
                        val: 'custom',
                        type: 'number',
                        attrs: {
                            id: 'simebv-zoom-numeric',
                            max: 400,
                            min: 10,
                            step: 10,
                            value: 100,
                        },
                        onchange: () => {
                            this.menu.groups.zoom.select('custom')
                        },
                        suffix: '%',
                        prefix: '',
                        labelID: 'simebv-zoom-label',
                    }],
                ],
                onclick: (value) => {
                    switch (value) {
                        case 'fit-page':
                        case 'fit-width':
                            this.view?.renderer?.setAttribute('zoom', value)
                            this.#savePreference('zoom', value)
                            break
                        case 'custom':
                            let val = this.#root.getElementById('simebv-zoom-numeric').value
                            if (!isNumeric(val) || val < 10 || val > 400 ) {
                                val = 100
                            }
                            this.view?.renderer?.setAttribute('zoom', val / 100)
                            this.#savePreference('custom-zoom', val)
                            this.#savePreference('zoom', value)
                            break
                        default:
                            if (!isNumeric(value)) {
                                break
                            }
                            value = Number(value)
                            if (value >= 10 && value <= 400) {
                                const inputElem = this.#root.getElementById('simebv-zoom-numeric')
                                inputElem.value = value
                                inputElem.dispatchEvent(new Event('change'))
                            }
                    }
                },
                onvalidate: (value) => {
                    return (
                        ['fit-page', 'fit-width', 'custom'].includes(value)
                        || (isNumeric(value) && Number(value) >= 10 && Number(value) <= 400)
                    )
                }
            }
        ])
        this.menu.element.classList.add('simebv-menu')
        this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'
        if (screen?.orientation) {
            screen.orientation.addEventListener('change', () => {
                console.log('orientatin changed')
                this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'
            })
        }
        this.menu.element.addEventListener('click', (e) => e.stopPropagation())

        this.#menuButton.append(this.menu.element)
        this.#menuButton.querySelector('button').addEventListener('click', (e) => {
            if (!this.menu.element.classList.contains('simebv-show')) {
                this.menu.element.show(this.#menuButton.querySelector('button'))
                this.#overlay.classList.add('simebv-show')
            }
            else {
                this.closeMenus()
            }
        })
        this.#loadMenuPreferences([
            ['fontSize', 18],
        ])
        this.menu.groups.history.items.previous.enable(false)
        this.menu.groups.history.items.next.enable(false)

        this.#fullscreenButton.addEventListener('click', this.#toggleFullViewport.bind(this))
    }

    get containerHeight() {
        return this.container.getBoundingClientRect().height
    }

    createFilterDialog(bookContainer, isFixedLayout) {
        if (!this.#colorsFilterDialog) {
            this.#colorsFilterDialog = colorFiltersDialog(bookContainer, this.#appliedFilter, isFixedLayout)
            this.#colorsFilterDialog.id = 'simebv-colors-filter-dialog'
            this.#rootDiv.append(this.#colorsFilterDialog)
            this.#colorsFilterDialog.addEventListener('close', () => {
                for (const prop in this.#appliedFilter) {
                    this.#savePreference(prop, this.#appliedFilter[prop])
                }
            })
        }
    }

    openFilterDialog(bookContainer) {
        if (!this.#colorsFilterDialog) {
            this.createFilterDialog(bookContainer)
        }
        this.#colorsFilterDialog.showModal()
    }

    openSearchDialog() {
        if (!this.#searchDialog) {
            this.#searchDialog = searchDialog(
                this.boundDoSearch,
                this.boundPrevMatch,
                this.boundNextMatch,
                this.boundSearchCleanUp,
                this.container
            )
            this.#searchDialog.id = 'simebv-search-dialog'
            this.#rootDiv.append(this.#searchDialog)
        }
        this.#searchDialog.show()
        this.#searchDialog.classList.add('simebv-show')
    }

    async doSearch(str) {
        if (this.#currentSearch && this.#currentSearchQuery === str) {
            await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this.#currentSearchQuery = str
        this.#currentSearch = await this.view?.search({query: str})
        await this.nextMatch()
    }
    boundDoSearch = this.doSearch.bind(this)

    async nextMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#currentSearchResult
                && this.#currentSearchResult.length > 0
                && this.#currentSearchResultIndex < this.#currentSearchResult.length - 1
        ) {
            this.#currentSearchResultIndex++
            await this.view.goTo(this.#currentSearchResult[this.#currentSearchResultIndex].cfi)
            return
        }
        let result = await this.#currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this.#currentSearchResult.push(...result.value.subitems)
            this.#currentSearchResultIndex++
            await this.view.goTo(this.#currentSearchResult[this.#currentSearchResultIndex].cfi)
            return
        }
        else {
            await this.nextMatch()
        }
    }
    boundNextMatch = this.nextMatch.bind(this)

    async prevMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#currentSearchResult
                && this.#currentSearchResult.length > 0
                && this.#currentSearchResultIndex > 0
        ) {
            this.#currentSearchResultIndex--
            await this.view.goTo(this.#currentSearchResult[this.#currentSearchResultIndex].cfi)
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        this.#currentSearch = undefined
        this.#currentSearchResult = []
        this.#currentSearchResultIndex = -1
        this.view.clearSearch()
        this.view.deselect()
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)

    async open(file) {
        this.view = document.createElement('foliate-view')
        this.#bookContainer.append(this.view)
        await this.view.open(file)
        if (this.view.isFixedLayout) {
            this.#bookContainer.classList.add('simebv-fxd-layout')
            this.menu.groups.layout.visible(false)
            this.menu.groups.maxPages.visible(false)
            this.menu.groups.fontSize.visible(false)
            this.menu.groups.margins.visible(false)
            this.menu.groups.zoom.visible(true)
            // Ensure that the last element of the menu is visible (cosmetic hack)
            this.menu.groups.zoom.element.parentNode.parentNode.append(this.menu.groups.zoom.element.parentNode)
        }
        else {
            this.#bookContainer.classList.remove('simebv-fxd-layout')
            this.menu.groups.layout.visible(true)
            this.menu.groups.fontSize.visible(true)
            this.menu.groups.maxPages.visible(true)
            this.menu.groups.margins.visible(true)
            this.menu.groups.zoom.visible(false)
            // Ensure that the last element of the menu is visible (cosmetic hack)
            this.menu.groups.colorFilter.element.parentNode.parentNode.append(this.menu.groups.colorFilter.element.parentNode)
        }
        this.view.addEventListener('load', this.#onLoad.bind(this))
        this.view.addEventListener('relocate', this.#onRelocate.bind(this))
        this.view.addEventListener('relocate', () => this.#canSavePreferences = true, { once: true })
        this.view.history.addEventListener('index-change', this.#updateHistoryMenuItems.bind(this))
        this.#lastReadPage = this.getLastReadPage()

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

        if (this.#lastReadPage != null) {
            try {
                if (typeof this.#lastReadPage === 'string') {
                    await this.view.init({lastLocation: this.#lastReadPage})
                }
                else if (this.#lastReadPage <= 1 && this.#lastReadPage >= 0) {
                    await this.view.init({lastLocation: { fraction: this.#lastReadPage }})
                }
            }
            catch (e) {
                this.#lastReadPage = null
                console.error('Cannot load last read page:', e)
            }
        }

        this.view.renderer.setStyles?.(getCSS(this.style))
        if (!this.#lastReadPage) this.view.renderer.next()

        this.#root.querySelector('#simebv-header-bar').style.visibility = 'visible'
        this.#root.querySelector('#simebv-nav-bar').style.visibility = 'visible'
        this.#root.querySelector('#simebv-left-button').addEventListener('click', () => this.view.goLeft())
        this.#root.querySelector('#simebv-right-button').addEventListener('click', () => this.view.goRight())

        const slider = this.#root.querySelector('#simebv-progress-slider')
        slider.dir = book.dir
        slider.addEventListener('input', e =>
            this.view.goToFraction(parseFloat(e.target.value)))
        for (const fraction of this.view.getSectionFractions()) {
            const option = document.createElement('option')
            option.value = fraction
            this.#root.querySelector('#simebv-tick-marks').append(option)
        }

        this.container.addEventListener('keydown', this.#handleKeydown.bind(this))
        const title = formatLanguageMap(book.metadata?.title) || 'Untitled Book'
        document.title = title
        this.#root.querySelector('#simebv-book-header').innerText = title
        this.#root.querySelector('#simebv-side-bar-title').innerText = title
        this.#root.querySelector('#simebv-side-bar-author').innerText = formatContributor(book.metadata?.author)
        Promise.resolve(book.getCover?.())?.then(blob =>
            blob ? this.#root.querySelector('#simebv-side-bar-cover').src = URL.createObjectURL(blob) : null)

        const toc = book.toc
        if (toc) {
            this.#tocView = createTOCView(toc, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this.closeMenus()
            })
            this.#root.querySelector('#simebv-toc-view').append(this.#tocView.element)
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

        this.#loadMenuPreferences([
            ['colors', 'auto'],
        ])
        if (this.view.isFixedLayout) {
            this.#loadMenuPreferences([
                ['zoom', 'fit-page']
            ])
        }
        else {
            this.#loadMenuPreferences([
                ['maxPages', 2],
                ['margins', '8%'],
                ['layout', 'paginated'],  // the 'scrolled' layout disables other preferences, so this is at the end
            ])
        }
        this.#loadFilterPreferences()
        this.createFilterDialog(this.#rootDiv, this.view.isFixedLayout)
    }

    #updateHistoryMenuItems() {
        this.view?.history?.canGoBack
            ? this.menu.groups.history.items.previous.enable(true)
            : this.menu.groups.history.items.previous.enable(false)
        this.view?.history?.canGoForward
            ? this.menu.groups.history.items.next.enable(true)
            : this.menu.groups.history.items.next.enable(false)
    }

    #toggleFullScreen() {
        if (this.view && this.view.requestFullscreen) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            else {
                this.view.requestFullscreen();
            }
        }
    }

    #toggleFullViewport() {
        if (this.container.classList.contains('simebv-view-fullscreen')) {
            this.container.classList.remove('simebv-view-fullscreen')
            this.#fullscreenButton.querySelector('#simebv-icon-enter-fullscreen').classList.remove('simebv-icon-hidden')
            this.#fullscreenButton.querySelector('#simebv-icon-exit-fullscreen').classList.add('simebv-icon-hidden')
        }
        else {
            this.container.classList.add('simebv-view-fullscreen')
            this.#fullscreenButton.querySelector('#simebv-icon-enter-fullscreen').classList.add('simebv-icon-hidden')
            this.#fullscreenButton.querySelector('#simebv-icon-exit-fullscreen').classList.remove('simebv-icon-hidden')
        }
        if (this.menu) {
            this.menu.element.style.maxBlockSize = 'min(85svh, ' + Math.round(this.containerHeight - 62) + 'px)'
        }
    }

    #handleKeydown(e) {
        if (this.#colorsFilterDialog.open) {
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
                        || this.#root.querySelector('#simebv-side-bar')?.classList.contains('simebv-show')) {
                    this.closeMenus()
                }
                break
            case 'Escape':
                if (this.menu.element.classList.contains('simebv-show')
                        || this.#root.querySelector('#simebv-side-bar')?.classList.contains('simebv-show')
                        || this.#searchDialog?.classList.contains('simebv-show')) {
                    this.closeMenus()
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

    #onLoad({ detail: { doc } }) {
        const loadingOverlay = this.#root.getElementById('simebv-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('simebv-show');
        }
        doc.addEventListener('keydown', this.#handleKeydown.bind(this))
        if (this.view.isFixedLayout) {
            doc.addEventListener('dblclick', () => {
                if (['fit-page', 'fit-width'].includes(this.menu.groups.zoom.current())) {
                    this.menu.groups.zoom.select('custom')
                }
                else {
                    this.menu.groups.zoom.select('fit-page')
                }
            })
        }
    }

    #onRelocate({ detail }) {
        const { fraction, location, tocItem, pageItem } = detail
        this.#savePreference(
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
        const slider = this.#root.querySelector('#simebv-progress-slider')
        slider.style.visibility = 'visible'
        slider.value = fraction
        slider.title = `${percent} · ${loc}`
        const writtenPercent = this.#root.querySelector('#simebv-progress-percent')
        writtenPercent.innerText = percent
        if (tocItem?.href) this.#tocView?.setCurrentHref?.(tocItem.href)
    }

    getBookIdentifier() {
        return this.view?.book?.metadata?.identifier || null
    }

    getCurrentTitle() {
        return formatLanguageMap(this.view?.book?.metadata?.title) || 'Untitled Book'
    }

    getLastReadPage() {
        const iden = this.getBookIdentifier() ?? this.getCurrentTitle()
        return this.#loadPreference(iden + '_LastPage')
    }

    #savePreferences(prefs) {
        if (!storageAvailable('localStorage') || !this.#canSavePreferences) {
            return
        }
        for (const [name, value] of prefs) {
            this.#savePreference(name, value)
        }
    }

    #loadFilterPreferences() {
        if (!this.#appliedFilter) {
            return
        }
        for (const prop in this.#appliedFilter) {
            let value = this.container.getAttribute('data-simebv-' + prop.toLowerCase())
            value = Reader.#convertUserSettings(prop, value)
            if (value != null) {
                this.#appliedFilter[prop] = value
            }
        }
        if (storageAvailable('localStorage')) {
            for (const prop in this.#appliedFilter) {
                let value = JSON.parse(localStorage.getItem('simebv-' + prop))
                if (value != null) {
                    this.#appliedFilter[prop] = value
                }
            }
        }
    }

    #savePreference(name, value) {
        if (!storageAvailable('localStorage') || !this.#canSavePreferences) {
            return
        }
        localStorage.setItem('simebv-' + name, JSON.stringify(value))
    }

    #loadPreference(name) {
        if (!storageAvailable('localStorage')) {
            return
        }
        return JSON.parse(localStorage.getItem('simebv-' + name))
    }

    static #convertUserSettings(name, value) {
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

    #loadMenuPreferences(values) {
        if (!this.menu) {
            return
        }
        // Retrieve data set by the user server side, validate it and store it as default
        const defValues = values.map((item) => {
            const [name, _] = item
            let attrVal = this.container.getAttribute('data-simebv-' + name.toLowerCase())
            attrVal = Reader.#convertUserSettings(name, attrVal)
            if (attrVal && this.menu.groups[name].validate(attrVal)) {
                return [name, attrVal]
            }
            return item
        })
        // if there is no localStorage available, select default values on the menu
        if (!storageAvailable('localStorage')) {
            for (const [name, defVal] of defValues) {
                this.menu.groups[name].select(defVal)
            }
            return
        }
        // Retrieve data from localStorage, validate it and select it on the menu, otherwise use default
        for (const [name, defVal] of defValues) {
            if (name === 'zoom') {
                const savedCustomZoom = this.#loadPreference('custom-zoom')
                if (this.menu.groups.zoom.validate(savedCustomZoom)) {
                    // this will not trigger the change event
                    this.menu.element.querySelector('#simebv-zoom-numeric').value = savedCustomZoom
                }
            }
            let savedVal = JSON.parse(localStorage.getItem('simebv-' + name))
            this.menu.groups[name].validate(savedVal)
                ? this.menu.groups[name].select(savedVal)
                : (
                    this.menu.groups[name].select(defVal),
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

        const leftButton = root.getElementById('simebv-left-button')
        const leftButtonLabel = __('Go left', 'simple-ebook-viewer')
        leftButton.setAttribute('aria-label', leftButtonLabel)
        leftButton.title = leftButtonLabel

        const rightButton = root.getElementById('simebv-right-button')
        const rightButtonLabel = __('Go right', 'simple-ebook-viewer')
        rightButton.setAttribute('aria-label', rightButtonLabel)
        rightButton.title = rightButtonLabel
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
    <div id="simebv-nav-bar" class="simebv-toolbar">
        <button id="simebv-left-button" aria-label="Go left">
            <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M 15 6 L 9 12 L 15 18"/>
            </svg>
        </button>
        <input id="simebv-progress-slider" type="range" min="0" max="1" step="any" list="simebv-tick-marks">
        <datalist id="simebv-tick-marks"></datalist>
        <div id="simebv-progress-percent"></div>
        <button id="simebv-right-button" aria-label="Go right">
            <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M 9 6 L 15 12 L 9 18"/>
            </svg>
        </button>
    </div>
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
