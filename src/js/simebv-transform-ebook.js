export function transformDoc(data, type, ops) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        for (const [op, args] of ops.entries()) {
            switch (op) {
                case 'addCSPMeta':
                    addCSPMeta(doc)
                    break
                case 'removeInlineScripts':
                    removeInlineScripts(doc)
                    break
                case 'injectMathJax':
                    injectMathJax(doc, ...args)
                    break
            }
        }
        if (ops.has('convertFontSizePxToRem')) {
            const fontSize = ops.get('convertFontSizePxToRem')[0]
            doc.querySelectorAll('style')
                .forEach(s => s.textContent = convertFontSizePxToRem(
                    s.textContent, fontSize)
                )
        }
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

function addCSPMeta(doc) {
    const meta = doc.createElement('meta')
    meta.setAttribute('http-equiv', 'content-security-policy')
    meta.setAttribute('content', "script-src 'none'; script-src-attr 'none'; script-src-elem 'none'")
    meta.setAttribute('data-simebv-inject', 'true')
    doc.head ? doc.head.prepend(meta) : doc.documentElement.prepend(meta)
}

function removeInlineScripts(doc) {
    doc.querySelectorAll('script').forEach(el => el.replaceWith(doc.createElement('style')))
}

function injectMathJax(doc, url, config) {
    const scriptConfig = doc.createElement('script')
    scriptConfig.textContent = config
    const script = doc.createElement('script')
    script.setAttribute('defer', 'true')
    script.src = url
    doc.head
        ? doc.head.append(scriptConfig, script)
        : doc.documentElement.prepend(scriptConfig, script)
}

export function convertFontSizePxToRem(data, defaultSize) {
    return data.replace(
        /(?<=[{\s;])font-size:\s*([0-9]*\.?[0-9]+)px/gi,
        (match, p1, offset, string) => {
            const n = parseFloat(p1)
            return 'font-size:' + (Math.round((n / defaultSize) * 1000) / 1000) + 'rem'
        })
}
