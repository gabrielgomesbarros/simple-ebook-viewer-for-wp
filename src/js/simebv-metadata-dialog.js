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
    ['published', __('Publication date', 'simple-ebook-viewer'), 'formatDate'],
    ['subject', __('Subject', 'simple-ebook-viewer'), 'formatContributor'],
    ['description', __('Description', 'simple-ebook-viewer'), 'formatOneContributor'],
    ['source', __('Source', 'simple-ebook-viewer'), 'formatContributor'],
    ['rights', __('Rights', 'simple-ebook-viewer'), 'formatOneContributor'],
    ['pageBreakSource', __("Source of the page list", 'simple-ebook-viewer'), 'formatOneContributor'],
    ['identifier', __('Identifier', 'simple-ebook-viewer'), 'formatId'],
    ['altIdentifier', __('Other identifiers', 'simple-ebook-viewer'), 'formatContributor'],
]

export function metadataDialog(metadata, locales, ebookFormat) {
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

    const formatId = x => typeof x === 'string'
        ? x.replace(/^urn:([a-z0-9]+):(.+)$/i, (_, g1, g2) => `${g2} (${g1.toUpperCase()})`) : x

    const formatLanguageMap = x => {
        if (!x) { return '' }
        if (typeof x === 'string') { return formatId(x) }
        const keys = Object.keys(x)
        return formatId(x[keys[0]])
    }

    const formatOneContributor = contributor => typeof contributor === 'string'
        ? formatId(contributor) : formatLanguageMap(contributor?.name)

    const formatContributor = contributor => Array.isArray(contributor)
        ? listFormat.format(contributor.map(formatOneContributor))
        : formatOneContributor(contributor)

    const formatDate = d => {
        if (typeof d === 'string') {
            try {
                const date = new Date(d)
                return date.toISOString().split('T')[0]
            }
            catch(e) {}
            return d
        }
        return d
    }

    const formatFunctions = {
        formatLanguageMap,
        formatOneContributor,
        formatContributor,
        formatDate,
        formatId,
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
    if (ebookFormat) {
        list.append(
            ...makeEntry(__('Ebook format', 'simple-ebook-viewer'), ebookFormat, (s => s))
        )
    }

    return dlg
}