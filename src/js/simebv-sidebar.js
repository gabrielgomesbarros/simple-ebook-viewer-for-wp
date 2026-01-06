import { commonStyles } from './simebv-component-styles.js'
const { __, _x, _n, sprintf } = wp.i18n

const template = document.createElement('template')
template.innerHTML = `
<style>
#side-bar {
    visibility: hidden;
    box-sizing: border-box;
    position: absolute;
    z-index: 3;
    top: 0;
    left: 0;
    height: 100%;
    width: 32ch;
    max-width: 85%;
    transform: translateX(-320px);
    display: flex;
    flex-direction: column;
    background: var(--sidebar-bg);
    color: CanvasText;
    border-right: solid 1px CanvasText;
    box-shadow: 3px 0 5px 1px var(--side-bar-box-shadow-color);
}
#side-bar.show {
    visibility: visible;
    transform: translateX(0);
    transition-delay: 0s;
}
#side-bar-header {
    padding: 1rem;
    display: flex;
    border-bottom: 1px solid rgba(0, 0, 0, .1);
    align-items: center;
}
#side-bar-cover {
    height: 10vh;
    min-height: 60px;
    max-height: 180px;
    border-radius: 3px;
    border: 0;
    background: lightgray;
    box-shadow: 0 0 1px rgba(0, 0, 0, .1), 0 0 16px rgba(0, 0, 0, .1);
    margin-inline-end: 1rem;
}
#side-bar-cover:not([src]) {
    display: none;
}
#side-bar-header div:has(#side-bar-title) {
    min-width: 0;
}
#side-bar-title {
    margin: .5rem 0;
    font-size: inherit;
    overflow-wrap: break-word;
}
#side-bar-author {
    margin: .5rem 0;
    font-size: smaller;
    color: var(--gray-text);
}
#navigation-view {
    overflow-y: auto;
}
.toc-view {
    padding: .5rem;
    display: none;
}
.toc-view.show {
    display: block;
}
.toc-view h3 {
    font-size: inherit;
}
.toc-view li, .toc-view ol {
    margin: 0;
    padding: 0;
    list-style: none;
}
.toc-view a, .toc-view span {
    display: block;
    border-radius: 6px;
    padding: 8px;
    margin: 2px 0;
}
.toc-view a {
    color: CanvasText;
    text-decoration: none;
}
.toc-view a:hover {
    background: var(--active-bg);
}
.toc-view span {
    color: var(--gray-text);
}
.toc-view svg {
    margin-inline-start: -24px;
    padding-inline-start: 5px;
    padding-inline-end: 6px;
    fill: CanvasText;
    cursor: default;
    transition: transform .2s ease;
    opacity: .5;
}
.toc-view svg:hover {
    opacity: 1;
}
.toc-view [aria-current] {
    font-weight: bold;
    background: var(--active-bg);
}
.toc-view [aria-expanded="false"] svg {
    transform: rotate(-90deg);
}
.toc-view [aria-expanded="false"] + [role="group"] {
    display: none;
}
</style>
<div id="side-bar">
    <div id="side-bar-header">
        <img id="side-bar-cover">
        <div>
            <h2 id="side-bar-title"></h2>
            <p id="side-bar-author"></p>
            <p>
                <a href="javascript:void(0)" id="side-bar-details"></a>
            </p>
        </div>
    </div>
    <div id="navigation-view" tabindex="-1">
        <nav id="toc-view" class="toc-view"></nav>
        <nav id="page-list-view" class="toc-view"></nav>
    </div>
</div>
`

export class SideBar extends HTMLElement {
    root
    cover
    title
    author
    details
    tocView
    pageListView
    toc
    pageList
    #lastFocus

    constructor() {
        super()
        this.attachShadow({ mode: 'open', delegatesFocus: true })
        this.shadowRoot.append(
            commonStyles.content.cloneNode(true),
            template.content.cloneNode(true),
        )
        this.root = this.shadowRoot.getElementById('side-bar')
        this.cover = this.shadowRoot.getElementById('side-bar-cover')
        this.title = this.shadowRoot.getElementById('side-bar-title')
        this.author = this.shadowRoot.getElementById('side-bar-author')
        this.details = this.shadowRoot.getElementById('side-bar-details')
        this.tocView = this.shadowRoot.getElementById('toc-view')
        this.pageListView = this.shadowRoot.getElementById('page-list-view')
        this.details.textContent = __('Details', 'simple-ebook-viewer')
    }

    setInitialFocus() {
        if (this.#lastFocus) {
            this.#lastFocus.focus()
        }
        else {
            this.details.focus()
        }
    }

    saveLastFocus() {
        this.#lastFocus = this.shadowRoot.activeElement
    }

    connectedCallback() {
        this.setAttribute('aria-label', __('Ebook metadata and navigation trees', 'simple-ebook-viewer'))
        this.setAttribute('role', 'navigation')
        this.root.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.dispatchEvent(new CustomEvent('side-bar-close'))
            }
            if (e.key === 'Tab') {
                if (this.tocView.contains(this.shadowRoot.activeElement)) {
                    if (!e.shiftKey) {
                        if (this.hasPageList()) {
                            e.preventDefault()
                            const activeElement = this.toc.getCurrentItem()
                            let node = this.pageList?.getCurrentItem()
                            if (node) {
                                node.focus()
                            }
                            else {
                                node = this.pageListView.querySelector('a')
                                node.focus()
                            }
                            // node.tabIndex = 0
                            // if (activeElement) activeElement.tabIndex = -1
                        }
                        else {
                            this.dispatchEvent(new CustomEvent('side-bar-close'))
                        }
                    }
                }
                else if (this.pageListView.contains(this.shadowRoot.activeElement)) {
                    if (e.shiftKey && this.hasToc()) {
                        e.preventDefault()
                        const activeElement = this.pageList.getCurrentItem()
                        let node = this.toc?.getCurrentItem()
                        if (node) {
                            node.focus()
                        }
                        else {
                            node = this.tocView.querySelector('a')
                            node.focus()
                        }
                        // node.tabIndex = 0
                        // if (activeElement) activeElement.tabIndex = -1
                    }
                    else if (!e.shiftKey) {
                        this.dispatchEvent(new CustomEvent('side-bar-close'))
                    }
                }
                else if (this.shadowRoot.activeElement === this.details && e.shiftKey) {
                    this.dispatchEvent(new CustomEvent('side-bar-close'))
                }
            }
        })
        this.root.addEventListener('click', () => this.dispatchEvent(new CustomEvent('side-bar-clicked')))
        this.details.addEventListener('click', (e) => {
            this.dispatchEvent(new CustomEvent('show-details'))
            e.preventDefault()
            e.stopPropagation()
        })
    }

    isVisible() {
        return this.root.classList.contains('show')
    }

    show() {
        this.root.classList.add('show')
    }

    hide() {
        this.root.classList.remove('show')
    }

    setTitle(title) {
        this.title.textContent = title
    }

    setAuthor(author) {
        this.author.textContent = author
    }

    setCover(urlCover) {
        this.cover.src = urlCover
    }

    attachToc(toc) {
        this.toc = toc
        this.tocView.textContent = ''
        const h = document.createElement('h3')
        h.textContent = __('Table of contents', 'simple-ebook-viewer')
        this.tocView.append(h, toc.element)
        this.tocView.classList.add('show')
    }

    attachPageList(pageList) {
        this.pageList = pageList
        this.pageListView.textContent = ''
        const h = document.createElement('h3')
        h.textContent = __('Page list', 'simple-ebook-viewer')
        this.pageListView.append(h, pageList.element)
        this.pageListView.classList.add('show')
    }

    hasToc() {
        return this.tocView.children.length > 0
    }

    hasPageList() {
        return this.pageListView.children.length > 0
    }
}

customElements.define('simebv-reader-sidebar', SideBar)
