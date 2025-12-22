const { __, _x, _n, sprintf } = wp.i18n

export const metadataMap = [
    ['title', __('Title', 'simple-ebook-viewer'), 'formatLanguageMap'],
    ['subtitle', __('Subtitle', 'simple-ebook-viewer'), 'formatLanguageMap'],
    ['author', __('Author', 'simple-ebook-viewer'), 'formatContributor'],
    ['editor', __('Editor', 'simple-ebook-viewer'), 'formatContributor'],
    ['translator', __('Translator', 'simple-ebook-viewer'), 'formatContributor'],
    ['artist', __('Artist', 'simple-ebook-viewer'), 'formatContributor'],
    ['illustrator', __('Illustrator', 'simple-ebook-viewer'), 'formatContributor'],
    ['colorist', __('Colorist', 'simple-ebook-viewer'), 'formatContributor'],
    ['narrator', __('Narrator', 'simple-ebook-viewer'), 'formatContributor'],
    ['language', __('Language', 'simple-ebook-viewer'), 'formatContributor'],
    ['publisher', __('Publisher', 'simple-ebook-viewer'), 'formatContributor'],
    ['published', __('Publication date', 'simple-ebook-viewer'), 'formatOneContributor'],
    ['subject', __('Subject', 'simple-ebook-viewer'), 'formatContributor'],
    ['description', __('Description', 'simple-ebook-viewer'), 'formatOneContributor'],
    ['source', __('Source', 'simple-ebook-viewer'), 'formatContributor'],
    ['rights', __('Rights', 'simple-ebook-viewer'), 'formatOneContributor'],
]

export function metadataDialog(metadata, locales) {
    const dlg = document.createElement('dialog')
    dlg.closedBy = 'any'
    const container = document.createElement('div')
    const list = document.createElement('dl')
    const close = document.createElement('button')
    close.textContent = __('OK', 'simple-ebook-viewer')
    close.addEventListener('click', () => dlg.close())
    dlg.append(container)
    container.append(list, close)

    const listFormat = new Intl.ListFormat(locales, { style: 'short', type: 'unit' })

    const formatLanguageMap = x => {
        if (!x) { return '' }
        if (typeof x === 'string') { return x }
        const keys = Object.keys(x)
        return x[keys[0]]
    }

    const formatOneContributor = contributor => typeof contributor === 'string'
        ? contributor : formatLanguageMap(contributor?.name)

    const formatContributor = contributor => Array.isArray(contributor)
        ? listFormat.format(contributor.map(formatOneContributor))
        : formatOneContributor(contributor)

    const formatFunctions = {
        formatLanguageMap,
        formatOneContributor,
        formatContributor,
    }

    const makeEntry = (key, val, f) => {
        const k = document.createElement('dt')
        k.textContent = key
        const v = document.createElement('dd')
        v.textContent = f(val)
        return [k, v]
    }

    for (const [key, name, format] of metadataMap) {
        if (metadata[key]) {
            const f = typeof format === 'function'
                ? format
                : (formatFunctions[format] ?? (s => s))
            list.append(...makeEntry(name, metadata[key], f))
        }
    }

    return dlg
}