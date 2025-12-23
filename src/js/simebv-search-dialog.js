const { __, _x, _n, sprintf } = wp.i18n;

export function searchDialog(onSearch, prevMatch, nextMatch, cleanup, returnFocus) {
    const dlg = document.createElement('dialog')
    const input = document.createElement('input')
    input.id = 'simebv-search-input'
    input.type = 'search'
    input.setAttribute('aria-label', __('Search', 'simple-ebook-viewer'))
    input.setAttribute('placeholder', __('Search', 'simple-ebook-viewer'))
    input.setAttribute('autofocus', true)
    // input.setAttribute('size', '10')

    const buttons = document.createElement('menu')
    const prevButton = document.createElement('button')
    prevButton.classList.add('simebv-button-icon')
    prevButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="-1 -2 18 18">
  <path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"/>
</svg>`
    prevButton.type = 'button'
    const prevButtonLabel = __('Previous result', 'simple-ebook-viewer')
    prevButton.setAttribute('aria-label', prevButtonLabel)
    prevButton.title = prevButtonLabel
    prevButton.setAttribute('disabled', true)
    const nextButton = document.createElement('button')
    nextButton.classList.add('simebv-button-icon')
    nextButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="-1 -2 18 18">
  <path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1"/>
</svg>`
    nextButton.type = 'button'
    const nextButtonLabel = __('Next result', 'simple-ebook-viewer')
    nextButton.setAttribute('aria-label', nextButtonLabel)
    nextButton.title = nextButtonLabel
    nextButton.setAttribute('disabled', true)
    const closeButton = document.createElement('button')
    closeButton.classList.add('simebv-button-icon')
    closeButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="CanvasText" viewBox="2 1 12 12">
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
</svg>`
    closeButton.type = 'reset'
    const closeButtonLabel = __('Close', 'simple-ebook-viewer')
    closeButton.setAttribute('aria-label', closeButtonLabel)
    closeButton.title = closeButtonLabel
    buttons.append(prevButton, nextButton, closeButton)

    dlg.append(input, buttons)

    const close = () => {
        cleanup()
        prevButton.disabled = true
        nextButton.disabled = true
        dlg.classList.remove('simebv-show')
        dlg.close('')
        if (returnFocus) {
            returnFocus.focus()
        }
    }

    let searching = false
    input.addEventListener('keydown', async (e) => {
        switch (e.key) {
            case 'Enter':
                if (searching) break
                const txt = input.value
                if (txt) {
                    searching = true
                    try {
                        await onSearch(txt, e.shiftKey)
                        prevButton.disabled = false
                        nextButton.disabled = false
                    }
                    finally {
                        searching = false
                    }
                }
                break
        }
    })

    prevButton.addEventListener('click', prevMatch)
    nextButton.addEventListener('click', nextMatch)
    closeButton.addEventListener('click', close)

    dlg.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'Escape':
                close()
                e.stopPropagation()
                e.preventDefault()
                break
        }
    })

    return dlg
}