// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
export function storageAvailable(type) {
    let storage;
    try {
        storage = window[type];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return (
            e instanceof DOMException &&
            e.name === "QuotaExceededError" &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        );
    }
}

export function isNumeric(v) {
    return parseFloat(v) === Number(v)
}

export function getLang(el) {
    while (el) {
        if (el.hasAttribute('lang')) {
            return el.getAttribute('lang')
        }
        el = el.parentElement
    }
}

export function pageListOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 2, radius = 3, label = '', fontSize = 16 } = options
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    if (rects.length > 0) {
        const { left, top, height, width } = rects[0]
        const pathHeight = Math.min(height, fontSize * 1.7)
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        el.setAttribute('d', `M ${left - 1},${top + pathHeight} v ${-pathHeight}`)// l 6 -3`)
        el.style.opacity = 'var(--overlayer-highlight-opacity, .8)'
        el.style.mixBlendMode = 'var(--overlayer-highlight-blend-mode, normal)'
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}
