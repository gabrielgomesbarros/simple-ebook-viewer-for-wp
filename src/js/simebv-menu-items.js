import { isNumeric } from './simebv-utils.js'
const { __, _x, _n, sprintf } = wp.i18n;

export function createMenuItemsStd(reader, injectCSS) {
    return new Map([
        ['search', {
            name: 'search',
            label: __('Search...', 'simple-ebook-viewer'),
            shortcut: 'Ctrl+F',
            type: 'action',
            onclick: () => reader.openSearchDialog(),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['history', {
            name: 'history',
            label: __('History', 'simple-ebook-viewer'),
            type: 'group',
            items: [
                {
                    name: 'previous',
                    label: __('Previous', 'simple-ebook-viewer'),
                    classList: ['simebv-action-menu-item'],
                    onclick: () => {
                        reader.view?.history?.back()
                    }
                },
                {
                    name: 'next',
                    label: __('Next', 'simple-ebook-viewer'),
                    classList: ['simebv-action-menu-item'],
                    onclick: () => {
                        reader.view?.history?.forward()
                    }
                }
            ]
        }],

        ['layout', {
            name: 'layout',
            label: __('Layout', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Paginated', 'simple-ebook-viewer'), 'paginated'],
                [__('Scrolled', 'simple-ebook-viewer'), 'scrolled'],
            ],
            onclick: value => {
                if (value === 'scrolled') {
                    reader.menu.groups.maxPages?.enable(false)
                    reader.menu.groups.margins?.enable(false)
                }
                else {
                    reader.menu.groups.maxPages?.enable(true)
                    reader.menu.groups.margins?.enable(true)
                }
                reader.view?.renderer.setAttribute('flow', value)
                reader._savePreference('layout', value)
            },
            horizontal: false,
        }],

        ['maxPages', {
            name: 'maxPages',
            label: __('Max pages per view', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                ['1', 1], ['2', 2], ['3', 3], ['4', 4],
            ],
            onclick: value => {
                reader.view?.renderer.setAttribute('max-column-count', value)
                reader._savePreference('maxPages', value)
            },
            horizontal: true,
        }],

        ['fontSize', {
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
                reader.style.fontSize = value
                reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                reader._savePreference('fontSize', value)
            },
            horizontal: false,
        }],

        ['margins', {
            name: 'margins',
            label: __('Page Margins', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [_x('Small', 'Margins', 'simple-ebook-viewer'), '4%'],
                [_x('Medium', 'Margins', 'simple-ebook-viewer'), '8%'],
                [_x('Large', 'Margins', 'simple-ebook-viewer'), '12%'],
            ],
            onclick: value => {
                reader.view?.renderer.setAttribute('gap', value)
                reader.view?.renderer.setAttribute('max-block-size', `calc(100% - ${value.slice(0, -1) * 2}%)`)
                reader._savePreference('margins', value)
            },
            horizontal: false,
        }],

        ['positionViewer', {
            name: 'positionViewer',
            label: __('Show position', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Slider', 'simple-ebook-viewer'), 'slider'],
                [__('Percentage', 'simple-ebook-viewer'), 'percent'],
                [__('Pages', 'simple-ebook-viewer'), 'pages'],
            ],
            onclick: value => {
                reader._navBar.setAttribute('position-view-type', value)
                reader._savePreference('positionViewer', value)
            },
            horizontal: false,
        }],

        ['colors', {
            name: 'colors',
            label: __('Colors', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [_x('Auto', 'Theme color', 'simple-ebook-viewer'), 'auto'],
                [_x('Sepia', 'Theme color', 'simple-ebook-viewer'), 'simebv-sepia'],
                [_x('Light', 'Theme color', 'simple-ebook-viewer'), 'simebv-light'],
                [_x('Dark', 'Theme color', 'simple-ebook-viewer'), 'simebv-dark'],
                [_x('Light (forced)', 'Theme color', 'simple-ebook-viewer'), 'simebv-light-forced'],
                [_x('Dark (forced)', 'Theme color', 'simple-ebook-viewer'), 'simebv-dark-forced'],
            ],
            onclick: value => {
                switch (value) {
                    case 'simebv-sepia':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-light', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#f9f1cc'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-light':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#ffffff'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-light-forced':
                        reader._rootDiv.classList.add('simebv-light')
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#ffffff'
                        reader.style.forcedColorScheme = 'light'
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-dark':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-light'
                        )
                        reader.style.colorScheme = 'only dark'
                        reader.style.bgColor = '#090909'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-dark-forced':
                        reader._rootDiv.classList.add('simebv-dark')
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-light'
                        )
                        reader.style.colorScheme = 'only dark'
                        reader.style.bgColor = '#090909'
                        reader.style.forcedColorScheme = 'dark'
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'auto':
                    default:
                        reader._rootDiv.classList.add('simebv-supports-dark')
                        reader._rootDiv.classList.remove(
                            'simebv-sepia', 'simebv-light', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'light dark'
                        reader.style.bgColor = 'transparent'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                }
                reader._savePreference('colors', value)
            },
            horizontal: false,
        }],

        ['fontFamily', {
            name: 'fontFamily',
            label: __('Font style...', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader.openFontsDialog(),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['colorFilter', {
            name: 'colorFilter',
            label: __('Color filter...', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader.openFilterDialog(reader._bookContainer),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['zoom', {
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
                        reader.menu.groups.zoom.select('custom')
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
                        reader.view?.renderer?.setAttribute('zoom', value)
                        reader._savePreference('zoom', value)
                        break
                    case 'custom':
                        let val = this._root.getElementById('simebv-zoom-numeric').value
                        if (!isNumeric(val) || val < 10 || val > 400 ) {
                            val = 100
                        }
                        reader.view?.renderer?.setAttribute('zoom', val / 100)
                        reader._savePreference('custom-zoom', val)
                        reader._savePreference('zoom', value)
                        break
                    default:
                        if (!isNumeric(value)) {
                            break
                        }
                        value = Number(value)
                        if (value >= 10 && value <= 400) {
                            const inputElem = this._root.getElementById('simebv-zoom-numeric')
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
        }],
    ])
}


export function getInitialMenuStatusStd() {
    return {
        bothBefore: [
            ['colors', 'auto'],
            ['positionViewer', 'slider'],
        ],
        fixedLayout: [
            ['zoom', 'fit-page'],
        ],
        reflowable: [
            ['fontSize', 18],
            ['maxPages', 2],
            ['margins', '8%'],
            ['layout', 'paginated'],  // the 'scrolled' layout disables other preferences, so this is at the end
        ],
        bothAfter: [],
    }
}
