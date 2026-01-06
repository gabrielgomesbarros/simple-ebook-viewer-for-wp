const { __, _x, _n, sprintf } = wp.i18n


export function annotationsDialog(reader) {
    const dlg = document.createElement('dialog')
    dlg.setAttribute('aria-labelledby', 'simebv-annotations-dialog-header')

    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const header = document.createElement('h2')
    header.classList.add('simebv-header-dialog')
    header.textContent = __('Show/hide annotations', 'simple-ebook-viewer')
    header.id = 'simebv-annotations-dialog-header'

    const fieldset = document.createElement('fieldset')

    const bookmarksContainer = document.createElement('div')
    const bookmarks = document.createElement('input')
    bookmarks.type = 'checkbox'
    bookmarks.id = 'simebv-bookmarks-checkbox'
    bookmarks.name = 'simebv-bookmarks-checkbox'
    bookmarks.checked = !!reader._showAnnotations
    const bookmarksLabel = document.createElement('label')
    bookmarksLabel.textContent = __('Show Calibre Bookmarks', 'simple-ebook-viewer')
    bookmarksLabel.htmlFor = bookmarks.id
    bookmarksContainer.append(bookmarks, bookmarksLabel)

    const pageListContainer = document.createElement('div')
    const pageList = document.createElement('input')
    pageList.type = 'checkbox'
    pageList.id = 'simebv-pagelist-checkbox'
    pageList.name = 'simebv-pagelist-checkbox'
    pageList.checked = !!reader._showPageDelimiters
    const pageListLabel = document.createElement('label')
    pageListLabel.htmlFor = pageList.id
    pageListLabel.innerHTML = __('Show page delimiters', 'simple-ebook-viewer') + ' <span style="font-size: small">(e.g. of the ebook\'s paper version)</span>'
    pageListContainer.append(pageList, pageListLabel)

    fieldset.append(bookmarksContainer, pageListContainer)

    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const accept = document.createElement('button')
    accept.type = 'submit'
    accept.textContent = __('OK', 'simple-ebook-viewer')
    accept.addEventListener('click', () => dlg.close())
    const dismiss = document.createElement('button')
    dismiss.textContent = __('Cancel', 'simple-ebook-viewer')
    dismiss.addEventListener('click', () => dlg.dispatchEvent(new Event('cancel')))
    buttons.append(accept, dismiss)

    form.append(header, fieldset, buttons)

    dlg.append(form)

    dlg.addEventListener('submit', (e) => {
        const formData = new FormData(form)
        const bookmarksId = bookmarks.id
        const index = reader.view.lastLocation?.section?.current
        if (formData.has(bookmarksId)) {
            if (!reader._showAnnotations) {
                reader.view.addEventListener('create-overlay', reader.boundBookmarksCreateOverlay)
                reader.view.addEventListener('show-annotation', reader.boundBookmarksShowAnnotation)
                reader._showAnnotations = true
                if (index !== undefined) {
                    reader.boundBookmarksCreateOverlay({ detail: { index }})
                }
            }
            reader._savePreference('show-annotations', reader._showAnnotations)
        }
        else if (reader._showAnnotations) {
            reader.view.removeEventListener('create-overlay', reader.boundBookmarksCreateOverlay)
            reader.view.removeEventListener('show-annotation', reader.boundBookmarksShowAnnotation)
            reader._showAnnotations = false
            if (reader.annotations.has(index)) {
                for (const annotation of reader.annotations.get(index)) {
                    reader.view.deleteAnnotation(annotation)
                }
            }
            reader._savePreference('show-annotations', reader._showAnnotations)
        }
        const pageListId = pageList.id
        if (formData.has(pageListId)) {
            if (!reader._showPageDelimiters) {
                reader.view.addEventListener('create-overlay', reader.boundPageListCreateOverlay)
                reader.view.addEventListener('show-annotation', reader.boundPageListShowAnnotation)
                reader._showPageDelimiters = true
                if (index !== undefined) {
                    reader.boundPageListCreateOverlay({ detail: { index }})
                }
            }
            reader._savePreference('show-page-delimiters', reader._showPageDelimiters)
        }
        else if (reader._showPageDelimiters) {
            reader.view.removeEventListener('create-overlay', reader.boundPageListCreateOverlay)
            reader.view.removeEventListener('show-annotation', reader.boundPageListShowAnnotation)
            reader._showPageDelimiters = false
            if (reader.pageList.has(index)) {
                for (const page of reader.pageList.get(index)) {
                    reader.view.deleteAnnotation(page)
                }
            }
            reader._savePreference('show-page-delimiters', reader._showPageDelimiters)
        }
        reader._closeMenus()
    })

    dlg.addEventListener('cancel', () => {
        bookmarks.checked = reader._showAnnotations
        pageList.checked = reader._showPageDelimiters
        reader._closeMenus()
    })

    return dlg
}
