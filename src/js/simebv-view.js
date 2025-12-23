import { View } from '../../vendor/foliate-js/view.js'
import * as CFI from '../../vendor/foliate-js/epubcfi.js'

export class SimebvView extends View {
    cfiFilter = node => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return NodeFilter.FILTER_ACCEPT
        }
        if (node.matches('[data-simebv-inject]')) {
            return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
    }

    getCFI(index, range) {
        const baseCFI = this.book.sections[index].cfi ?? CFI.fake.fromIndex(index)
        if (!range) return baseCFI
        return CFI.joinIndir(baseCFI, CFI.fromRange(range, this.cfiFilter))
    }
    resolveCFI(cfi) {
        if (this.book.resolveCFI)
            return this.book.resolveCFI(cfi)
        else {
            const parts = CFI.parse(cfi)
            const index = CFI.fake.toIndex((parts.parent ?? parts).shift())
            const anchor = doc => CFI.toRange(doc, parts, this.cfiFilter)
            return { index, anchor }
        }
    }
}

customElements.define('simebv-foliate-view', SimebvView)
