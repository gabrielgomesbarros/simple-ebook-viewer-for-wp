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
    ['language', __('Language', 'simple-ebook-viewer'), 'formatLanguageCodes'],
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

export function metadataDialog(metadata, formatter, ebookFormat) {
    const dlg = document.createElement('dialog')
    dlg.closedBy = 'any'
    dlg.setAttribute('aria-label', __('Ebook metadata', 'simple-ebook-viewer'))
    const container = document.createElement('div')
    const list = document.createElement('dl')
    const close = document.createElement('button')
    close.textContent = __('OK', 'simple-ebook-viewer')
    close.addEventListener('click', () => dlg.close())
    dlg.append(container)
    container.append(list, close)

    const makeEntry = (key, val) => {
        const k = document.createElement('dt')
        k.textContent = key
        const v = document.createElement('dd')
        v.textContent = val
        return [k, v]
    }

    for (const [key, name, format] of metadataMap) {
        if (metadata[key]) {
            const formatted = format
                ? formatter.format(metadata[key], format)
                : metadata[key]
            list.append(...makeEntry(name, formatted))
        }
    }
    if (ebookFormat) {
        list.append(
            ...makeEntry(__('Ebook format', 'simple-ebook-viewer'), ebookFormat)
        )
    }

    return dlg
}

export class MetadataFormatter {
    #locales
    #listFormat
    #langFormat

    constructor(locales) {
        this.#locales = locales
        this.#listFormat = new Intl.ListFormat(locales, { style: 'short', type: 'unit' })
        this.#langFormat = new Intl.DisplayNames(locales, { type: 'language', languageDisplay: 'standard' })
    }

    format(data, func) {
        const f = typeof func === 'string'
            ? this[func]?.bind(this) ?? (s => s)
            : func
        return f(data)
    }

    formatId(x) {
        return typeof x === 'string'
            ? x.replace(/^urn:([a-z0-9]+):(.+)$/i, (_, g1, g2) => `${g2} (${g1.toUpperCase()})`)
            : x
    }

    formatLanguageMap(x) {
        if (!x) { return '' }
        if (typeof x === 'string') { return this.formatId(x) }
        const keys = Object.keys(x)
        return this.formatId(x[keys[0]])
    }

    formatOneContributor(contributor) {
        return typeof contributor === 'string'
            ? this.formatId(contributor)
            : this.formatLanguageMap(contributor?.name)
    }

    formatContributor(contributor) {
        return Array.isArray(contributor)
            ? this.#listFormat.format(contributor.map(this.formatOneContributor.bind(this)))
            : this.formatOneContributor(contributor)
    }

    formatLanguageCodes(codes) {
        return Array.isArray(codes)
            ? this.#listFormat.format(codes.map(this.formatLanguageCode.bind(this)))
            : this.formatLanguageCode(codes)
        }

    formatLanguageCode(x) {
        try {
            const formatted = this.#langFormat.of(x)
            if (formatted) {
                return formatted
            }
        } catch (e) {
           // TypeError if x is not string or object
           // RangeError if x is a syntactically invalid string
        }
        return x
    }

    formatDate(d) {
        if (typeof d === 'string') {
            try {
                const date = new Date(d)
                return date.toISOString().split('T')[0]
            }
            catch(e) {}
        }
        return d
    }
}
