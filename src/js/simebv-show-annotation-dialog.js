const { __, _x, _n, sprintf } = wp.i18n

export function createShowAnnotationDialog() {
    const dlg = document.createElement('dialog')
    dlg.closedBy = 'any'
    dlg.setAttribute('aria-labelledby', 'simebv-show-annotation-dlg-header')
    const h = document.createElement('h2')
    h.id = 'simebv-show-annotation-dlg-header'
    const annotation = document.createElement('p')
    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const close = document.createElement('button')
    close.textContent = __('OK', 'simple-ebook-viewer')
    close.addEventListener('click', () => dlg.close())
    buttons.append(close)
    dlg.append(h, annotation, buttons)

    let returnFocusTo
    const showAnnotation = (str, header, returnFocus) => {
        h.textContent = header ?? __('Annotation', 'simple-ebook-viewer')
        annotation.textContent = str
        returnFocusTo = returnFocus
        dlg.showModal()
    }

    dlg.addEventListener('close', () => {
        if (returnFocusTo) returnFocusTo.focus()
    })

    return { element: dlg, showAnnotation }
}
