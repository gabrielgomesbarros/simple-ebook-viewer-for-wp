import { commonStyles } from './simebv-component-styles.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
#side-bar {
    visibility: hidden;
    box-sizing: border-box;
    position: absolute;
    z-index: 2;
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
#side-bar-title {
    margin: .5rem 0;
    font-size: inherit;
}
#side-bar-author {
    margin: .5rem 0;
    font-size: smaller;
    color: var(--gray-text);
}
#toc-view {
    padding: .5rem;
    overflow-y: auto;
}
#toc-view li, #toc-view ol {
    margin: 0;
    padding: 0;
    list-style: none;
}
#toc-view a, #toc-view span {
    display: block;
    border-radius: 6px;
    padding: 8px;
    margin: 2px 0;
}
#toc-view a {
    color: CanvasText;
    text-decoration: none;
}
#toc-view a:hover {
    background: var(--active-bg);
}
#toc-view span {
    color: var(--gray-text);
}
#toc-view svg {
    margin-inline-start: -24px;
    padding-inline-start: 5px;
    padding-inline-end: 6px;
    fill: CanvasText;
    cursor: default;
    transition: transform .2s ease;
    opacity: .5;
}
#toc-view svg:hover {
    opacity: 1;
}
#toc-view [aria-current] {
    font-weight: bold;
    background: var(--active-bg);
}
#toc-view [aria-expanded="false"] svg {
    transform: rotate(-90deg);
}
#toc-view [aria-expanded="false"] + [role="group"] {
    display: none;
}
</style>
<div id="side-bar">
    <div id="side-bar-header">
        <img id="side-bar-cover">
        <div>
            <h2 id="side-bar-title"></h2>
            <p id="side-bar-author"></p>
        </div>
    </div>
    <div id="toc-view"></div>
</div>
`

export class SideBar extends HTMLElement {
    root
    cover
    title
    author
    tocView

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
        this.tocView = this.shadowRoot.getElementById('toc-view')
    }

    connectedCallback() {
        this.root.addEventListener('click', () => this.dispatchEvent(new CustomEvent('side-bar-clicked')))
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
        this.tocView.append(toc)
    }
}

customElements.define('simebv-reader-sidebar', SideBar)
