import { commonStyles } from './simebv-component-styles.js'
const { __, _x, _n, sprintf } = wp.i18n;

const template = document.createElement('template')
template.innerHTML = `
<style>
#nav-bar {
    bottom: 0;
}
#position-viewer {
    flex-grow: 1;
    margin: 0 12px;
}
#progress-slider {
    width: 100%;
    display: none;
}
#progress-percent, #progress-pages {
    margin: 0 12px;
    display: none;
    text-align: center;
}
</style>
<div id="nav-bar" class="simebv-toolbar">
    <button id="left-button" aria-label="Go left">
        <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M 15 6 L 9 12 L 15 18"/>
        </svg>
    </button>
    <div id="position-viewer">
        <input id="progress-slider" type="range" min="0" max="1" step="any" list="tick-marks">
        <datalist id="tick-marks"></datalist>
        <div id="progress-percent"></div>
        <div id="progress-pages"></div>
    </div>
    <button id="right-button" aria-label="Go right">
        <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M 9 6 L 15 12 L 9 18"/>
        </svg>
    </button>
</div>
`

export class NavBar extends HTMLElement {
    static observedAttributes = ["position-view-type"]
    root
    buttonLeft
    buttonRight
    positionViewer
    slider
    percent
    pages

    constructor() {
        super()
        this.attachShadow({ mode: 'open', delegatesFocus: true })
        this.shadowRoot.append(
            commonStyles.content.cloneNode(true),
            template.content.cloneNode(true)
        )
        this.root = this.shadowRoot.getElementById('nav-bar')
        this.buttonLeft = this.shadowRoot.getElementById('left-button')
        this.buttonRight = this.shadowRoot.getElementById('right-button')
        this.positionViewer = this.shadowRoot.getElementById('position-viewer')
        this.slider = this.shadowRoot.getElementById('progress-slider')
        this.percent = this.shadowRoot.getElementById('progress-percent')
        this.pages = this.shadowRoot.getElementById('progress-pages')

        this.setLocalizedLabels()

        const sliderDataList = this.shadowRoot.getElementById('tick-marks')
        this.addEventListener('new-book', ({ detail }) => {
            this.slider.dir = detail.dir || 'auto'
            sliderDataList.textContent = ''
            for (const fraction of detail.fractions) {
                const option = document.createElement('option')
                option.value = fraction
                sliderDataList.append(option)
            }
            this.root.style.visibility = 'visible'
        })
        this.addEventListener('relocate', this.boundUpdatePositionViewer)
    }

    setLocalizedLabels() {
        const leftButtonLabel = __('Turn left page', 'simple-ebook-viewer')
        this.buttonLeft.setAttribute('aria-label', leftButtonLabel)
        this.buttonLeft.title = leftButtonLabel
        const rightButtonLabel = __('Turn right page', 'simple-ebook-viewer')
        this.buttonRight.setAttribute('aria-label', rightButtonLabel)
        this.buttonRight.title = rightButtonLabel
    }

    connectedCallback() {
        this.buttonLeft.addEventListener(
            'click', () => this.dispatchEvent(new CustomEvent('go-left', { bubbles: true }))
        )
        this.buttonRight.addEventListener(
            'click', () => this.dispatchEvent(new CustomEvent('go-right', { bubbles: true }))
        )
        this.slider.addEventListener(
            'input',
            e => {
                this.changedPageSlider = true
                this.dispatchEvent(new CustomEvent('changed-page-slider', { detail: { newLocation: e.target.value }, bubbles: true }))
            }
        )
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (oldValue) {
            case 'slider':
                this.slider.style.display = 'none'
                break
            case 'percent':
                this.percent.style.display = 'none'
                break
            case 'pages':
                this.pages.style.display = 'none'
                break
        }
        switch (newValue) {
            case 'slider':
                this.slider.style.display = 'block'
                break
            case 'percent':
                this.percent.style.display = 'block'
                break
            case 'pages':
                this.pages.style.display = 'block'
                break
        }
    }

    updatePositionViewer({ detail }) {
        this.slider.title = detail.sliderTitle
        if (!this.changedPageSlider) {
            this.slider.value = detail.sliderValue
        }
        this.changedPageSlider = false
        this.percent.innerText = detail.percent
        this.pages.innerText = detail.page
    }
    boundUpdatePositionViewer = this.updatePositionViewer.bind(this)
}

customElements.define('simebv-reader-navbar', NavBar)
