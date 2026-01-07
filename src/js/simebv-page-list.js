import * as CFI from '../../vendor/foliate-js/epubcfi.js'


function getLastNode(cfi) {
    for (let i = cfi.length - 1; i > 0; i--) {
        if (cfi[i] === '/' && /[0-9]/.test(cfi[i + 1])) {
            let j = i - 1
            let escapes = 0
            while (j && cfi[j] === '^') {
                escapes++
                j--
            }
            if (escapes % 2 === 0) {
                return cfi.substring(i + 1, cfi.length - 1)
            }
        }
    }
}

function nodeFilter(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return NodeFilter.FILTER_ACCEPT
    }
    if (['SCRIPT', 'NOSCRIPT', 'STYLE'].includes(node.tagName)) {
        return NodeFilter.FILTER_REJECT
    }
    if (globalThis.getComputedStyle(node).display === 'none') {
        return NodeFilter.FILTER_REJECT
    }
    return NodeFilter.FILTER_ACCEPT
}


/**
 * Create the cfi ranges and other properties for the page list annotations.
 * The nodes referenced in the ebooks's page lists are often empty
 * elements, sometimes inside a paragraphs, sometimes between paragraphs.
 * In Chromium, range.getClientRects() (used by the overlayer to draw the annotations)
 * in some cases returns an empty list when dealing with empty (or whitespace only)
 * text nodes (cfr. https://issues.chromium.org/issues/41387258).
 * So, I try to circumvent this issue by searching non-whitespace-only text nodes:
 * if the node referenced by the ebook's page list contains non-whitespace text,
 * start and end node of the range are its non-whitespace-only descendant text node.
 * Otherwise the start node of the range is the node referenced by the
 * ebook's page list, and the end node may vary: the function tries to always get
 * a not-whitespace-only text node, but if there isn't one it uses the first
 * html element that follows the start node; and if there isn't even this,
 * it skips the entry.
 */
export function createPageListForAnnotations(reader, bookPageList, index, doc) {
    const pageList = []
    const pageListByValue = new Map()
    for (const p of bookPageList) {
        const { index: i, anchor } = reader.view.resolveNavigation(p.href)
        if (i !== index) {
            continue
        }
        const node = anchor(doc)
        let startContainer = node
        const display = globalThis.getComputedStyle(node).display
        if (node.textContent?.trim() && display !== 'none') {
            const walker = document.createTreeWalker(
                node, NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT, nodeFilter
            )
            while (walker.nextNode()) {
                const child = walker.currentNode
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    startContainer = child
                    break
                }
            }
        }
        let endContainer
        let range = new Range()
        range.setStart(startContainer, 0)
        if (startContainer.nodeType === Node.TEXT_NODE) {
            range.setEnd(startContainer, startContainer.length - 1)
        }
        else {
            let root = node.getRootNode()
            const walker = document.createTreeWalker(
                root, NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT, nodeFilter
            )
            walker.currentNode = node
            walker.lastChild()
            extLoop: while (walker.nextNode()) {
                const current = walker.currentNode
                if (node.contains(current)) {
                    continue
                }
                if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
                    endContainer = current
                    break extLoop
                }
            }
            if (!endContainer) {
                walker.currentNode = node
                walker.lastChild()
                while (walker.nextNode()) {
                    const current = walker.currentNode
                    if (node.contains(current)) continue
                    if (current.nodeType === Node.ELEMENT_NODE) {
                        endContainer = current
                        break
                    }
                }
                if (!endContainer) {
                    continue
                }
            }
            range.setEnd(endContainer, endContainer.nodeType === Node.TEXT_NODE ? 1 : 0)
        }
        const sectionCFI = reader.view.getCFI(index)
        const cfiRange = sectionCFI.replace(/\)$/, '!') + CFI.fromRange(range).replace(/^epubcfi\(/, '')
        const annotation = { value: cfiRange, type: 'page-list', label: p.label, href: p.href }
        pageList.push(annotation)
        pageListByValue.set(annotation.value, annotation)
    }
    return { pageList, pageListByValue }
}
