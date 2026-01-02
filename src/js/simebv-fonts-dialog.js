const { __, _x, _n, sprintf } = wp.i18n;

export function fontsDialog(reader, injectCSS) {
    const dlg = document.createElement('dialog')
    dlg.setAttribute('aria-labelledby', 'simebv-font-dialog-header')
    // dlg.closedBy = 'any'

    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const header = document.createElement('h3')
    header.classList.add('simebv-header-dialog')
    header.textContent = 'Select Font Style'
    header.id = 'simebv-font-dialog-header'

    const fieldset = document.createElement('fieldset')

    const autoContainer = document.createElement('div')
    const auto = document.createElement('input')
    auto.type = 'radio'
    auto.id = 'simebv-font-auto'
    auto.name = 'simebv-font-family'
    auto.value = 'auto'
    auto.checked = true
    const autoLabel = document.createElement('label')
    autoLabel.htmlFor = 'simebv-font-auto'
    autoLabel.textContent = __('Auto', 'simple-ebook-viewer')
    autoContainer.append(auto, autoLabel)

    const serifContainer = document.createElement('div')
    const serif = document.createElement('input')
    serif.type = 'radio'
    serif.id = 'simebv-font-serif'
    serif.name = 'simebv-font-family'
    serif.value = 'serif'
    serif.checked = false
    const serifLabel = document.createElement('label')
    serifLabel.htmlFor = 'simebv-font-serif'
    serifLabel.textContent = __('Serif', 'simple-ebook-viewer')
    serifLabel.style.fontFamily = 'serif'
    serifContainer.append(serif, serifLabel)

    const sansSerifContainer = document.createElement('div')
    const sansSerif = document.createElement('input')
    sansSerif.type = 'radio'
    sansSerif.id = 'simebv-font-sans-serif'
    sansSerif.name = 'simebv-font-family'
    sansSerif.value = 'sans-serif'
    sansSerif.checked = false
    const sansSerifLabel = document.createElement('label')
    sansSerifLabel.htmlFor = 'simebv-font-sans-serif'
    sansSerifLabel.textContent = __('Sans Serif', 'simple-ebook-viewer')
    sansSerifLabel.style.fontFamily = 'sans-serif'
    sansSerifContainer.append(sansSerif, sansSerifLabel)

    const monospaceContainer = document.createElement('div')
    const monospace = document.createElement('input')
    monospace.type = 'radio'
    monospace.id = 'simebv-font-monospace'
    monospace.name = 'simebv-font-family'
    monospace.value = 'monospace'
    monospace.checked = false
    const monospaceLabel = document.createElement('label')
    monospaceLabel.htmlFor = 'simebv-font-monospace'
    monospaceLabel.textContent = __('Monospace', 'simple-ebook-viewer')
    monospaceLabel.style.fontFamily = 'monospace'
    monospaceContainer.append(monospace, monospaceLabel)

    fieldset.append(
        autoContainer,
        serifContainer,
        sansSerifContainer,
        monospaceContainer,
    )

    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const close = document.createElement('button')
    close.type = 'submit'
    close.textContent = __('OK', 'simple-ebook-viewer')
    close.addEventListener('click', () => dlg.close())
    const dismiss = document.createElement('button')
    dismiss.textContent = __('Close', 'simple-ebook-viewer')
    dismiss.addEventListener('click', () => dlg.dispatchEvent(new Event('cancel')))
    buttons.append(close, dismiss)

    form.append(header, fieldset, buttons)

    dlg.append(form)

    const families = {
        'auto': auto,
        'serif': serif,
        'sans-serif': sansSerif,
        'monospace': monospace,
    }
    const initialChecked = reader._loadPreference('font-family')
    if (initialChecked && families[initialChecked]) {
        families[initialChecked].checked = true
    }

    dlg.addEventListener('submit', () => {
        const formData = new FormData(form)
        const selected = formData.get('simebv-font-family')
        if (selected !== reader.style.fontFamily) {
            reader.style.fontFamily = selected
            reader.view?.renderer.setStyles?.(injectCSS(reader.style))
            reader._savePreference('font-family', selected)
        }
    })

    dlg.addEventListener('cancel', () => {
        if (families[reader.style.fontFamily]) {
            families[reader.style.fontFamily].checked = true
        }
    })

    return dlg
}